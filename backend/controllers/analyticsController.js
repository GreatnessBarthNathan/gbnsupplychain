const Funnel = require('../models/Funnel');
const FunnelVisit = require('../models/FunnelVisit');

function utcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getPeriodStarts(now = new Date()) {
  const today = utcDayStart(now);
  const week = new Date(today);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { today, week, month };
}

async function recordFunnelVisit(req, res, next) {
  try {
    const funnel = await Funnel.findOne({
      slug: req.params.slug,
      active: true,
      archived: { $ne: true }
    }).select('_id owner');
    if (!funnel) return res.status(404).json({ message: 'This product page is no longer available.' });
    if (req.workspaceOwnerId && String(req.workspaceOwnerId) === String(funnel.owner)) {
      return res.status(204).end();
    }

    const day = utcDayStart(new Date());
    const filter = { funnel: funnel._id, day };
    const update = {
      $setOnInsert: { owner: funnel.owner },
      $inc: { visits: 1 }
    };
    try {
      await FunnelVisit.updateOne(filter, update, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      await FunnelVisit.updateOne(filter, { $inc: { visits: 1 } });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function getFunnelAnalytics(req, res, next) {
  try {
    const owner = req.workspaceOwnerId;
    const funnels = await Funnel.find({ owner, active: true, archived: { $ne: true } })
      .select('_id name productName slug')
      .sort({ createdAt: -1 });
    const periods = getPeriodStarts();
    const counts = funnels.length
      ? await FunnelVisit.aggregate([
          { $match: { owner, funnel: { $in: funnels.map((funnel) => funnel._id) } } },
          {
            $group: {
              _id: '$funnel',
              daily: { $sum: { $cond: [{ $gte: ['$day', periods.today] }, '$visits', 0] } },
              weekly: { $sum: { $cond: [{ $gte: ['$day', periods.week] }, '$visits', 0] } },
              monthly: { $sum: { $cond: [{ $gte: ['$day', periods.month] }, '$visits', 0] } },
              allTime: { $sum: '$visits' }
            }
          }
        ])
      : [];
    const countsByFunnel = new Map(counts.map((item) => [String(item._id), item]));
    const funnelCounts = funnels.map((funnel) => {
      const count = countsByFunnel.get(String(funnel._id)) || {};
      return {
        _id: funnel._id,
        name: funnel.name,
        productName: funnel.productName,
        slug: funnel.slug,
        daily: count.daily || 0,
        weekly: count.weekly || 0,
        monthly: count.monthly || 0,
        allTime: count.allTime || 0
      };
    });
    const totals = funnelCounts.reduce((result, funnel) => {
      result.daily += funnel.daily;
      result.weekly += funnel.weekly;
      result.monthly += funnel.monthly;
      result.allTime += funnel.allTime;
      return result;
    }, { daily: 0, weekly: 0, monthly: 0, allTime: 0 });

    res.json({ totals, funnels: funnelCounts });
  } catch (error) {
    next(error);
  }
}

module.exports = { recordFunnelVisit, getFunnelAnalytics };
