const Order = require('../models/Order');
const Funnel = require('../models/Funnel');
const Rider = require('../models/Rider');

async function getDashboard(req, res, next) {
  try {
    const owner = req.workspaceOwnerId;
    const isAdmin = req.user.role === 'admin';
    const [orders, activeFunnels, riders, revenue, remitted] = await Promise.all([
      Order.countDocuments({ owner }),
      Funnel.countDocuments({ owner, active: true }),
      Rider.countDocuments({ owner, active: true }),
      isAdmin ? Order.aggregate([
        { $match: { owner, stage: { $in: ['delivered', 'transferred'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]) : Promise.resolve([]),
      isAdmin ? Order.aggregate([
        { $match: { owner, stage: 'transferred' } },
        { $group: { _id: null, total: { $sum: '$remittedAmount' } } }
      ]) : Promise.resolve([])
    ]);
    const stages = await Order.aggregate([
      { $match: { owner } },
      { $group: { _id: '$stage', count: { $sum: 1 } } }
    ]);
    const recentOrders = await Order.find({ owner })
      .populate('funnel', 'productName currency')
      .sort({ createdAt: -1 })
      .limit(6);
    res.json({
      stats: {
        orders,
        activeFunnels,
        riders,
        deliveredRevenue: isAdmin ? revenue[0]?.total || 0 : 0,
        remittedCash: isAdmin ? remitted[0]?.total || 0 : 0,
        stages: Object.fromEntries(stages.map((item) => [item._id, item.count]))
      },
      recentOrders
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboard };
