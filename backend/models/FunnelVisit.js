const mongoose = require('mongoose');

const funnelVisitSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    funnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', required: true },
    day: { type: Date, required: true },
    visits: { type: Number, required: true, default: 0, min: 0 }
  },
  { timestamps: true }
);

funnelVisitSchema.index({ funnel: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('FunnelVisit', funnelVisitSchema);
