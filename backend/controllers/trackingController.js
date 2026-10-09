const Order = require('../models/Order');

async function getTracking(req, res, next) {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .select('orderNumber customerName stage stageHistory createdAt')
      .populate('rider', 'name phone');
    if (!order) return res.status(404).json({ message: 'We could not find that order.' });
    res.json(order);
  } catch (error) {
    next(error);
  }
}

module.exports = { getTracking };
