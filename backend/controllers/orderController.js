const crypto = require('crypto');
const mongoose = require('mongoose');
const Funnel = require('../models/Funnel');
const Notification = require('../models/Notification');
const Order = require('../models/Order');
const Rider = require('../models/Rider');
const RiderStock = require('../models/RiderStock');
const RiderStockTransfer = require('../models/RiderStockTransfer');
const { sendPushNotification } = require('../services/pushNotifications');
const { normalizeNigerianState } = require('../domain/nigerianStates');
const { canMoveOrder, isSameState, riderInventoryStages, transitions } = require('../domain/orderStages');

function getDiscountRateForQuantity(quantity) {
  if (quantity >= 4) return 0.07;
  if (quantity >= 3) return 0.06;
  if (quantity >= 2) return 0.05;
  return 0;
}

function getDiscountedTotal(unitPrice, quantity) {
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return 0;
  const discountRate = getDiscountRateForQuantity(numericQuantity);
  return Number((unitPrice * numericQuantity * (1 - discountRate)).toFixed(2));
}

async function returnFailedOrderToStock(order, note) {
  const stockFilter = { owner: order.owner, rider: order.rider, funnel: order.funnel };
  await RiderStock.findOneAndUpdate(
    stockFilter,
    { $inc: { quantity: order.quantity } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  let result;
  try {
    result = await Order.updateOne(
      {
        _id: order._id,
        stage: order.stage,
        rider: order.rider,
        redirectedTo: null,
        stockRestocked: { $ne: true }
      },
      {
        $set: { stage: 'failed', stockRestocked: true, note: note || '' },
        $push: {
          stageHistory: {
            stage: 'failed',
            note: note || 'Delivery failed; product returned to the rider’s available inventory.'
          }
        }
      }
    );
  } catch (error) {
    await RiderStock.updateOne(stockFilter, { $inc: { quantity: -order.quantity } });
    throw error;
  }
  if (!result.modifiedCount) {
    await RiderStock.updateOne(stockFilter, { $inc: { quantity: -order.quantity } });
    return false;
  }
  return true;
}

async function startSupplierReturnFromAvailableStock(order, note) {
  const stockFilter = { owner: order.owner, rider: order.rider, funnel: order.funnel, quantity: { $gte: order.quantity } };
  const stockReservation = await RiderStock.updateOne(stockFilter, { $inc: { quantity: -order.quantity } });
  if (!stockReservation.modifiedCount) return false;
  let result;
  try {
    result = await Order.updateOne(
      {
        _id: order._id,
        owner: order.owner,
        stage: 'failed',
        rider: order.rider,
        redirectedTo: null,
        stockRestocked: true
      },
      {
        $set: { stage: 'returning', stockRestocked: false, note: note || '' },
        $push: {
          stageHistory: {
            stage: 'returning',
            note: note || 'Owner directed the rider to return this available product to the supplier.'
          }
        }
      }
    );
  } catch (error) {
    await RiderStock.updateOne(
      { owner: order.owner, rider: order.rider, funnel: order.funnel },
      { $inc: { quantity: order.quantity } }
    );
    throw error;
  }
  if (!result.modifiedCount) {
    await RiderStock.updateOne(
      { owner: order.owner, rider: order.rider, funnel: order.funnel },
      { $inc: { quantity: order.quantity } }
    );
    return false;
  }
  return true;
}

async function reconcileFailedRiderStock(filter) {
  const failedOrders = await Order.find({
    ...filter,
    stage: 'failed',
    rider: { $ne: null },
    redirectedTo: null,
    stockRestocked: { $ne: true }
  });
  for (const order of failedOrders) {
    await returnFailedOrderToStock(order, 'Delivery failed; product returned to the rider’s available inventory.');
  }
}

async function listOrders(req, res, next) {
  try {
    const filter = { owner: req.workspaceOwnerId };
    const completed = req.query.completed === 'true';
    const stage = req.query.stage || 'all';
    const validStages = ['new', 'activated', 'in_transit', 'at_state', 'delivered', 'transferred', 'failed', 'returning', 'returned'];
    if (stage !== 'all' && !validStages.includes(stage)) {
      return res.status(400).json({ message: 'Choose a valid order stage.' });
    }
    if (completed) {
      filter.stage = stage === 'all' ? { $in: ['transferred', 'failed'] } : stage;
      if (stage !== 'all' && !['transferred', 'failed'].includes(stage)) {
        return res.status(400).json({ message: 'Completed orders can only be filtered by transferred or failed status.' });
      }
    } else if (stage === 'all') {
      filter.stage = { $nin: ['transferred', 'failed'] };
    } else {
      if (['transferred', 'failed'].includes(stage)) {
        return res.status(400).json({ message: 'Transferred and failed orders are listed under completed orders.' });
      }
      filter.stage = stage;
    }

    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      const matchingFunnels = await Funnel.find({ owner: req.workspaceOwnerId, productName: searchRegex })
        .select('_id')
        .lean();
      filter.$or = [
        { orderNumber: searchRegex },
        { customerName: searchRegex },
        { phone: searchRegex },
        { whatsapp: searchRegex },
        { address: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
        { funnel: { $in: matchingFunnels.map((funnel) => funnel._id) } }
      ];
    }

    const pageSize = completed ? 20 : 10;
    const requestedPage = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isInteger(requestedPage) || requestedPage < 1) {
      return res.status(400).json({ message: 'Page must be a positive integer.' });
    }
    const total = await Order.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pages);
    const orders = await Order.find(filter)
      .populate('funnel', 'productName currency')
      .populate('rider', 'name phone state')
      .populate('redirectedTo', 'orderNumber')
      .populate('redirectedFrom', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    res.json({ orders, total, page, pageSize, pages });
  } catch (error) {
    next(error);
  }
}

async function createPublicOrder(req, res, next) {
  try {
    const { customerName, phone, whatsapp, address, city, state, quantity } = req.body;
    const normalizedState = normalizeNigerianState(state);
    const normalizedCity = typeof city === 'string' ? city.trim() : '';
    const whatsappNumber = typeof whatsapp === 'string' ? whatsapp.trim() : '';
    const whatsappDigits = whatsappNumber.replace(/\D/g, '');
    if (!customerName?.trim() || !phone?.trim() || !address?.trim() || !normalizedCity || normalizedCity.length > 100 || !normalizedState) {
      return res.status(400).json({ message: 'Please provide your name, phone, delivery address, city, and state.' });
    }
    if (!whatsappNumber || whatsappDigits.length < 7 || whatsappDigits.length > 15) {
      return res.status(400).json({ message: 'Please provide a valid WhatsApp number with 7 to 15 digits.' });
    }
    const orderQuantity = Number(quantity);
    if (!Number.isInteger(orderQuantity) || orderQuantity < 1 || orderQuantity > 100) {
      return res.status(400).json({ message: 'Quantity must be between 1 and 100.' });
    }
    const funnel = await Funnel.findOne({ slug: req.params.slug, active: true });
    if (!funnel) return res.status(404).json({ message: 'This product page is no longer available.' });
    const discountedTotal = getDiscountedTotal(funnel.price, orderQuantity);
    const order = await Order.create({
      owner: funnel.owner,
      funnel: funnel.id,
      orderNumber: `GBN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      customerName,
      phone,
      whatsapp: whatsappNumber,
      address,
      city: normalizedCity,
      state: normalizedState,
      quantity: orderQuantity,
      total: discountedTotal,
      stageHistory: [{ stage: 'new', note: 'Order placed from product page.' }]
    });
    const notification = await Notification.create({
      owner: funnel.owner,
      order: order.id,
      message: `New order from ${order.customerName} for ${order.quantity} × ${funnel.productName}.`
    });
    void sendPushNotification(funnel.owner, notification).catch((error) => {
      console.error('Unable to send new-order push notification:', error.message);
    });
    res.status(201).json({ message: 'Your order has been placed.', orderNumber: order.orderNumber });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStage(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, owner: req.workspaceOwnerId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const { stage, riderId, note, serviceCharge } = req.body;
    if (stage === 'transferred' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an admin can record cash transferred to the account.' });
    }
    if (order.redirectedTo) {
      return res.status(400).json({ message: 'This parcel has been transferred to another customer order and cannot be moved again.' });
    }
    if (!canMoveOrder(order.stage, stage, order.redirectedTo)) {
      return res.status(400).json({ message: `An order cannot move from ${order.stage} to ${stage}.` });
    }
    if (stage === 'transferred') {
      if (serviceCharge === undefined || serviceCharge === null || serviceCharge === '' || !Number.isFinite(Number(serviceCharge))) {
        return res.status(400).json({ message: 'Enter the rider service charge agreed for this order.' });
      }
      const numericServiceCharge = Number(serviceCharge);
      if (numericServiceCharge < 0 || numericServiceCharge > order.total) {
        return res.status(400).json({ message: 'The rider service charge must be between zero and the COD amount.' });
      }
      order.remittanceServiceCharge = numericServiceCharge;
      order.remittedAmount = Number((order.total - numericServiceCharge).toFixed(2));
      order.remittedAt = new Date();
    }
    let rider = null;
    if (stage === 'at_state') {
      if (!riderId) return res.status(400).json({ message: 'Choose the dispatch rider picking up this order.' });
      rider = await Rider.findOne({ _id: riderId, owner: req.workspaceOwnerId, active: true });
      if (!rider) return res.status(400).json({ message: 'Choose an active rider belonging to your account.' });
      if (!isSameState(rider.state, order.state)) {
        return res.status(400).json({ message: 'Choose an active rider whose state matches the delivery destination.' });
      }
      order.rider = rider.id;
    }
    const previousStage = order.stage;
    const updatedNote = note?.trim() || '';
    let updatedOrder = order;
    if (stage === 'failed' && order.rider) {
      const restocked = await returnFailedOrderToStock(order, updatedNote);
      if (!restocked) return res.status(409).json({ message: 'This delivery changed before it could be returned to stock. Refresh and try again.' });
      updatedOrder = await Order.findById(order.id);
    } else if (stage === 'returning' && order.stage === 'failed' && order.stockRestocked) {
      const returnStarted = await startSupplierReturnFromAvailableStock(order, updatedNote);
      if (!returnStarted) return res.status(409).json({ message: 'Available stock changed before the return could start. Refresh and try again.' });
      updatedOrder = await Order.findById(order.id);
    } else {
      order.stage = stage;
      order.note = updatedNote;
      order.stageHistory.push({
        stage,
        note: order.note || (stage === 'transferred'
          ? 'Owner recorded the transfer to their account after deducting the rider service charge.'
          : `Order moved from ${previousStage} to ${stage}.`)
      });
      await order.save();
    }
    const notification = await Notification.create({
      owner: req.workspaceOwnerId,
      order: order.id,
      message: `${order.orderNumber} moved to ${stage.replace('_', ' ')}.`
    });
    void sendPushNotification(req.workspaceOwnerId, notification).catch((error) => {
      console.error('Unable to send order-status push notification:', error.message);
    });
    res.json(await updatedOrder.populate([
      { path: 'funnel', select: 'productName currency' },
      { path: 'rider', select: 'name phone state' }
    ]));
  } catch (error) {
    next(error);
  }
}

async function listRiders(req, res, next) {
  try {
    await reconcileFailedRiderStock({ owner: req.workspaceOwnerId });
    const riders = await Rider.find({ owner: req.workspaceOwnerId }).select('+accessToken').sort({ name: 1 }).lean();
    const [stock, availableStock, stockTransfers] = await Promise.all([
      Order.aggregate([
      { $match: { owner: req.workspaceOwnerId, stage: { $in: riderInventoryStages }, rider: { $ne: null }, redirectedTo: null, stockRestocked: { $ne: true } } },
      { $group: { _id: '$rider', quantity: { $sum: '$quantity' }, orders: { $sum: 1 } } }
      ]),
      RiderStock.find({ owner: req.workspaceOwnerId, quantity: { $gt: 0 } })
        .populate('funnel', 'productName currency')
        .lean(),
      RiderStockTransfer.find({ owner: req.workspaceOwnerId, status: 'in_transit' })
        .populate('funnel', 'productName currency')
        .lean()
    ]);
    const stockByRider = new Map(stock.map((item) => [item._id.toString(), item]));
    const availableByRider = new Map();
    const availableQuantityByRider = new Map();
    for (const item of availableStock) {
      const riderId = item.rider.toString();
      const riderStock = availableByRider.get(riderId) || [];
      riderStock.push({ funnel: item.funnel, quantity: item.quantity });
      availableByRider.set(riderId, riderStock);
      availableQuantityByRider.set(riderId, (availableQuantityByRider.get(riderId) || 0) + item.quantity);
    }
    const inTransitByRider = new Map();
    for (const transfer of stockTransfers) {
      const riderId = transfer.rider.toString();
      const riderTransfers = inTransitByRider.get(riderId) || [];
      riderTransfers.push(transfer);
      inTransitByRider.set(riderId, riderTransfers);
    }
    res.json(riders.map((rider) => ({
      ...rider,
      inventory: (stockByRider.get(rider._id.toString())?.quantity || 0)
        + (availableQuantityByRider.get(rider._id.toString()) || 0),
      assignedDeliveryItems: stockByRider.get(rider._id.toString())?.quantity || 0,
      availableStockItems: availableQuantityByRider.get(rider._id.toString()) || 0,
      activeOrders: stockByRider.get(rider._id.toString())?.orders || 0,
      stock: availableByRider.get(rider._id.toString()) || [],
      inTransitStock: inTransitByRider.get(rider._id.toString()) || []
    })));
  } catch (error) {
    next(error);
  }
}

async function addRiderStock(req, res, next) {
  try {
    const { funnelId, quantity } = req.body || {};
    const stockQuantity = Number(quantity);
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(funnelId)) {
      return res.status(400).json({ message: 'Choose a valid rider and product.' });
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity < 1 || stockQuantity > 10000) {
      return res.status(400).json({ message: 'Stock quantity must be a whole number between 1 and 10,000.' });
    }
    const [rider, funnel] = await Promise.all([
      Rider.findOne({ _id: req.params.id, owner: req.workspaceOwnerId, active: true }),
      Funnel.findOne({ _id: funnelId, owner: req.workspaceOwnerId, active: true })
    ]);
    if (!rider) return res.status(404).json({ message: 'Active rider not found.' });
    if (!funnel) return res.status(404).json({ message: 'Active product not found.' });
    const transfer = await RiderStockTransfer.create({
      owner: req.workspaceOwnerId,
      rider: rider.id,
      funnel: funnel.id,
      quantity: stockQuantity,
      status: 'in_transit'
    });
    res.status(201).json(await transfer.populate('funnel', 'productName currency'));
  } catch (error) {
    next(error);
  }
}

async function receiveRiderStock(req, res, next) {
  return confirmRiderStockReceipt(req, res, next, false);
}

async function receiveRiderStockAsOwner(req, res, next) {
  return confirmRiderStockReceipt(req, res, next, true);
}

async function confirmRiderStockReceipt(req, res, next, ownerInitiated) {
  let transfer;
  try {
    const rider = ownerInitiated
      ? await Rider.findOne({ _id: req.params.riderId, owner: req.workspaceOwnerId, active: true })
      : await Rider.findOne({ accessToken: req.params.accessToken, active: true }).select('+accessToken');
    if (!rider) {
      return res.status(404).json({
        message: ownerInitiated ? 'Active rider not found.' : 'This rider access link is no longer available.'
      });
    }
    if (!mongoose.isValidObjectId(req.params.transferId)) {
      return res.status(404).json({ message: 'Stock shipment not found.' });
    }
    transfer = await RiderStockTransfer.findOneAndUpdate(
      { _id: req.params.transferId, owner: rider.owner, rider: rider.id, status: 'in_transit' },
      { $set: { status: 'received', receivedAt: new Date() } },
      { new: true }
    );
    if (!transfer) return res.status(404).json({ message: 'This stock shipment was already received or is no longer available.' });
    try {
      await RiderStock.findOneAndUpdate(
        { owner: transfer.owner, rider: rider.id, funnel: transfer.funnel },
        { $inc: { quantity: transfer.quantity } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      await RiderStockTransfer.updateOne(
        { _id: transfer.id, rider: rider.id, status: 'received' },
        { $set: { status: 'in_transit', receivedAt: null } }
      );
      throw error;
    }
    const notification = await Notification.create({
      owner: transfer.owner,
      message: `${rider.name} confirmed receipt of ${transfer.quantity} units of stock.`
    });
    void sendPushNotification(transfer.owner, notification).catch((error) => {
      console.error('Unable to send stock-receipt push notification:', error.message);
    });
    res.json({ message: 'Stock receipt confirmed.', transfer });
  } catch (error) {
    next(error);
  }
}

async function assignOrderFromRiderStock(req, res, next) {
  let stockReserved = false;
  let riderId;
  let productId;
  let quantity;
  try {
    const { riderId: requestedRiderId } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(requestedRiderId)) {
      return res.status(400).json({ message: 'Choose a valid customer order and rider.' });
    }
    const order = await Order.findOne({
      _id: req.params.id,
      owner: req.workspaceOwnerId,
      stage: 'activated',
      rider: null,
      redirectedTo: null
    });
    if (!order) return res.status(404).json({ message: 'Confirmed customer order not found.' });
    const rider = await Rider.findOne({ _id: requestedRiderId, owner: req.workspaceOwnerId, active: true });
    if (!rider) return res.status(404).json({ message: 'Active rider not found.' });
    if (!isSameState(rider.state, order.state)) {
      return res.status(400).json({ message: 'Choose a rider whose state matches the customer’s delivery state.' });
    }

    riderId = rider.id;
    productId = order.funnel;
    quantity = order.quantity;
    const reservation = await RiderStock.updateOne(
      { owner: req.workspaceOwnerId, rider: rider.id, funnel: order.funnel, quantity: { $gte: order.quantity } },
      { $inc: { quantity: -order.quantity } }
    );
    if (!reservation.modifiedCount) {
      return res.status(400).json({ message: 'This rider does not have enough available stock for that product.' });
    }
    stockReserved = true;

    const assignment = await Order.updateOne(
      { _id: order.id, owner: req.workspaceOwnerId, stage: 'activated', rider: null, redirectedTo: null },
      {
        $set: { stage: 'at_state', rider: rider.id },
        $push: {
          stageHistory: {
            stage: 'at_state',
            note: `Assigned to ${rider.name} from the rider’s stored ${order.quantity}-unit product stock.`
          }
        }
      }
    );
    if (!assignment.modifiedCount) {
      await RiderStock.updateOne(
        { owner: req.workspaceOwnerId, rider: rider.id, funnel: order.funnel },
        { $inc: { quantity: order.quantity } }
      );
      stockReserved = false;
      return res.status(409).json({ message: 'This order changed before stock could be assigned. Refresh and try again.' });
    }
    stockReserved = false;
    const updatedOrder = await Order.findById(order.id)
      .populate('funnel', 'productName currency')
      .populate('rider', 'name phone state');
    const notification = await Notification.create({
      owner: req.workspaceOwnerId,
      order: order.id,
      message: `${order.orderNumber} was assigned to ${rider.name} from local stock.`
    });
    void sendPushNotification(req.workspaceOwnerId, notification).catch((error) => {
      console.error('Unable to send local-stock assignment push notification:', error.message);
    });
    res.json(updatedOrder);
  } catch (error) {
    if (stockReserved) {
      try {
        await RiderStock.updateOne(
          { owner: req.workspaceOwnerId, rider: riderId, funnel: productId },
          { $inc: { quantity } }
        );
      } catch (rollbackError) {
        console.error('Unable to restore rider stock after failed order assignment:', rollbackError.message);
      }
    }
    next(error);
  }
}

async function createRider(req, res, next) {
  try {
    const { name, phone, city, state } = req.body;
    const normalizedState = normalizeNigerianState(state);
    const normalizedCity = typeof city === 'string' ? city.trim() : '';
    if (!name?.trim() || !phone?.trim() || !normalizedCity || normalizedCity.length > 100 || !normalizedState) {
      return res.status(400).json({ message: 'Rider name, phone, city, and state are required.' });
    }
    const rider = await Rider.create({
      owner: req.workspaceOwnerId,
      name,
      phone,
      city: normalizedCity,
      state: normalizedState,
      accessToken: crypto.randomBytes(24).toString('hex')
    });
    res.status(201).json({ ...rider.toObject(), inventory: 0, activeOrders: 0 });
  } catch (error) {
    next(error);
  }
}

async function updateRider(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Rider not found.' });
    }
    const { name, phone, city, state, active } = req.body || {};
    const normalizedState = normalizeNigerianState(state);
    const normalizedCity = typeof city === 'string' ? city.trim() : '';
    if (
      typeof name !== 'string' || !name.trim() || name.trim().length > 100
      || typeof phone !== 'string' || !phone.trim() || phone.trim().length > 24
      || !normalizedCity || normalizedCity.length > 100
      || !normalizedState
      || typeof active !== 'boolean'
    ) {
      return res.status(400).json({ message: 'Rider name, phone, city, state, and status are required.' });
    }
    const rider = await Rider.findOneAndUpdate(
      { _id: req.params.id, owner: req.workspaceOwnerId },
      {
        $set: {
          name: name.trim(),
          phone: phone.trim(),
          city: normalizedCity,
          state: normalizedState,
          active
        }
      },
      { new: true, runValidators: true }
    ).select('+accessToken');
    if (!rider) return res.status(404).json({ message: 'Rider not found.' });
    res.json(rider);
  } catch (error) {
    next(error);
  }
}

async function getRiderPortal(req, res, next) {
  try {
    const rider = await Rider.findOne({ accessToken: req.params.accessToken, active: true }).select('+accessToken');
    if (!rider) return res.status(404).json({ message: 'This rider access link is no longer available.' });
    await reconcileFailedRiderStock({ owner: rider.owner, rider: rider.id });
    const orders = await Order.find({
      rider: rider.id,
      stage: { $in: riderInventoryStages },
      redirectedTo: null,
      stockRestocked: { $ne: true }
    })
      .select('owner orderNumber customerName phone whatsapp address city state quantity total stage stockRestocked redirectedFrom createdAt')
      .populate('funnel', 'productName currency')
      .populate('redirectedFrom', 'orderNumber')
      .sort({ updatedAt: -1 });
    const availableStock = await RiderStock.find({ owner: rider.owner, rider: rider.id, quantity: { $gt: 0 } })
      .populate('funnel', 'productName currency')
      .select('funnel quantity')
      .lean();
    const stockInTransit = await RiderStockTransfer.find({ owner: rider.owner, rider: rider.id, status: 'in_transit' })
      .populate('funnel', 'productName currency')
      .sort({ sentAt: 1 })
      .lean();
    const activeOrders = orders.filter((order) => order.stage !== 'failed').map((order) => {
      const { owner, ...orderData } = order.toObject();
      return orderData;
    });
    const assignedDeliveryItems = activeOrders.reduce((total, order) => total + order.quantity, 0);
    const availableStockItems = availableStock.reduce((total, stock) => total + stock.quantity, 0);
    res.json({
      rider: { name: rider.name, phone: rider.phone, city: rider.city, state: rider.state },
      inventory: assignedDeliveryItems + availableStockItems,
      assignedDeliveryItems,
      availableStockItems,
      availableStock,
      stockInTransit,
      activeOrders
    });
  } catch (error) {
    next(error);
  }
}

async function getRerouteOptions(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Failed delivery not found.' });
    }
    const source = await Order.findOne({
      _id: req.params.id,
      owner: req.workspaceOwnerId,
      stage: 'failed',
      redirectedTo: null
    });
    if (!source) return res.status(404).json({ message: 'Failed delivery not found.' });
    if (source.stockRestocked) {
      return res.status(400).json({ message: 'This parcel is already back in the rider’s available stock. Assign stock to a new confirmed customer order instead.' });
    }
    if (!source.rider) {
      return res.status(400).json({ message: 'This failed delivery has no assigned rider to carry the parcel.' });
    }
    const escapedState = source.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const options = await Order.find({
      owner: source.owner,
      _id: { $ne: source._id },
      stage: { $in: ['new', 'activated', 'in_transit'] },
      rider: null,
      funnel: source.funnel,
      quantity: source.quantity,
      state: new RegExp(`^${escapedState}$`, 'i')
    })
      .select('orderNumber customerName address city state quantity')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json(options);
  } catch (error) {
    next(error);
  }
}

async function updateRiderDelivery(req, res, next) {
  try {
    const rider = await Rider.findOne({ accessToken: req.params.accessToken, active: true }).select('+accessToken');
    if (!rider) return res.status(404).json({ message: 'This rider access link is no longer available.' });
    const { stage, note } = req.body || {};
    if (!['delivered', 'failed', 'returning', 'returned'].includes(stage)) {
      return res.status(400).json({ message: 'Choose a valid delivery or supplier-return update.' });
    }
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      return res.status(404).json({ message: 'Active delivery not found.' });
    }
    const order = await Order.findOne({
      _id: req.params.orderId,
      rider: rider.id,
      stage: { $in: ['at_state', 'failed', 'returning'] }
    });
    if (!order) return res.status(404).json({ message: 'Active rider inventory item not found.' });
    if (!transitions[order.stage]?.includes(stage)) {
      return res.status(400).json({ message: `This item cannot move from ${order.stage} to ${stage}.` });
    }
    const deliveryNote = typeof note === 'string' ? note.trim() : '';
    if (stage === 'returning') {
      return res.status(403).json({ message: 'Only the account owner can decide to return products to the supplier.' });
    }
    if (stage === 'failed') {
      const restocked = await returnFailedOrderToStock(order, deliveryNote);
      if (!restocked) return res.status(409).json({ message: 'This delivery changed before it could be returned to stock. Refresh and try again.' });
    } else {
      order.stage = stage;
      order.note = deliveryNote;
      order.stageHistory.push({
        stage,
        note: order.note || ({
          delivered: 'Rider confirmed delivery and cash collection.',
          failed: 'Rider reported that delivery was not completed. Item remains with rider.',
          returning: 'Rider started return of the item to the supplier.',
          returned: 'Supplier confirmed receipt of the returned item.'
        })[stage]
      });
      await order.save();
    }
    const notification = await Notification.create({
      owner: order.owner,
      order: order.id,
      message: `${order.orderNumber}: ${
        {
          delivered: 'delivered and paid',
          failed: `delivery failed; item returned to ${rider.name}’s available stock`,
          returning: 'return to supplier started',
          returned: 'supplier confirmed receipt'
        }[stage]
      }.`
    });
    void sendPushNotification(order.owner, notification).catch((error) => {
      console.error('Unable to send delivery-status push notification:', error.message);
    });
    res.json({ message: 'Delivery update saved.' });
  } catch (error) {
    next(error);
  }
}

async function redirectFailedOrder(req, res, next) {
  let sourceClaimed = false;
  let assignmentCompleted = false;
  let sourceId;
  let targetId;
  let sourceRiderId;
  try {
    const { targetOrderId } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.orderId) || !mongoose.isValidObjectId(targetOrderId)) {
      return res.status(400).json({ message: 'Choose a valid failed delivery and destination order.' });
    }
    const sourceQuery = {
      _id: req.params.orderId,
      owner: req.workspaceOwnerId,
      stage: 'failed',
      redirectedTo: null
    };
    const source = await Order.findOne(sourceQuery).populate('rider', 'name');
    if (!source) return res.status(404).json({ message: 'Failed delivery not found.' });
    const assignedRider = source.rider;
    if (!assignedRider) {
      return res.status(400).json({ message: 'This failed delivery has no assigned rider to carry the parcel.' });
    }
    if (source.stockRestocked) {
      return res.status(400).json({ message: 'This parcel is already back in the rider’s available stock. Assign stock to a new confirmed customer order instead.' });
    }
    if (!source.state || source._id.equals(targetOrderId)) {
      return res.status(400).json({ message: 'Choose another customer with an open order in the same state.' });
    }
    const escapedState = source.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const target = await Order.findOne({
      _id: targetOrderId,
      owner: source.owner,
      stage: { $in: ['new', 'activated', 'in_transit'] },
      rider: null,
      funnel: source.funnel,
      quantity: source.quantity,
      state: new RegExp(`^${escapedState}$`, 'i')
    });
    if (!target) {
      return res.status(400).json({ message: 'Choose an open order for the same product and quantity in the same state.' });
    }

    sourceId = source.id;
    targetId = target.id;
    sourceRiderId = assignedRider.id;
    const sourceClaim = await Order.updateOne(
      {
        _id: source._id,
        owner: source.owner,
        rider: sourceRiderId,
        stage: 'failed',
        redirectedTo: null
      },
      { $set: { redirectedTo: target.id } }
    );
    if (!sourceClaim.modifiedCount) {
      return res.status(409).json({ message: 'This failed delivery has already been updated. Refresh and try again.' });
    }
    sourceClaimed = true;

    const assignment = await Order.updateOne(
      {
        _id: target._id,
        owner: source.owner,
        stage: target.stage,
        rider: null,
        funnel: source.funnel,
        quantity: source.quantity,
        state: new RegExp(`^${escapedState}$`, 'i')
      },
      {
        $set: { stage: 'at_state', rider: sourceRiderId, redirectedFrom: source.id },
        $push: {
          stageHistory: {
            stage: 'at_state',
            note: `Assigned to ${assignedRider.name} using parcel from failed delivery ${source.orderNumber}.`
          }
        }
      }
    );
    if (!assignment.modifiedCount) {
      await Order.updateOne(
        { _id: source.id, owner: source.owner, rider: sourceRiderId, stage: 'failed', redirectedTo: target.id },
        { $set: { redirectedTo: null } }
      );
      sourceClaimed = false;
      return res.status(409).json({ message: 'That customer order was updated by someone else. Refresh and choose another order.' });
    }
    assignmentCompleted = true;
    await Order.updateOne(
      { _id: source.id, redirectedTo: target.id },
      { $push: { stageHistory: { stage: 'failed', note: `Parcel transferred to existing order ${target.orderNumber} for ${target.customerName}.` } } }
    );

    const notification = await Notification.create({
      owner: source.owner,
      order: source.id,
      message: `${source.orderNumber} remains failed. Its parcel is now assigned to existing order ${target.orderNumber} for ${target.customerName}.`
    });
    void sendPushNotification(source.owner, notification).catch((error) => {
      console.error('Unable to send rerouted-delivery push notification:', error.message);
    });
    res.status(201).json({
      message: `The parcel was assigned to ${target.orderNumber}; the customer's existing order was updated.`,
      orderNumber: target.orderNumber
    });
  } catch (error) {
    if (sourceClaimed && !assignmentCompleted) {
      try {
        await Order.updateOne(
          { _id: sourceId, rider: sourceRiderId, stage: 'failed', redirectedTo: targetId },
          { $set: { redirectedTo: null } }
        );
      } catch (cleanupError) {
        console.error('Unable to release failed-order reroute claim:', cleanupError.message);
      }
    }
    next(error);
  }
}

function redirectOwnerDelivery(req, res, next) {
  return redirectFailedOrder(req, res, next);
}

async function getNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ owner: req.workspaceOwnerId }).sort({ createdAt: -1 }).limit(20);
    res.json(notifications);
  } catch (error) {
    next(error);
  }
}

async function clearNotifications(req, res, next) {
  try {
    await Notification.deleteMany({ owner: req.workspaceOwnerId });
    res.json({ message: 'Notifications cleared.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  createPublicOrder,
  updateOrderStage,
  listRiders,
  createRider,
  updateRider,
  addRiderStock,
  receiveRiderStock,
  receiveRiderStockAsOwner,
  assignOrderFromRiderStock,
  getRiderPortal,
  getRerouteOptions,
  updateRiderDelivery,
  redirectOwnerDelivery,
  getNotifications,
  clearNotifications
};
