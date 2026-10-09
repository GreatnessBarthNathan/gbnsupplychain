const mongoose = require('mongoose');

const riderStockSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    funnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 }
  },
  { timestamps: true }
);

riderStockSchema.index({ rider: 1, funnel: 1 }, { unique: true });

module.exports = mongoose.model('RiderStock', riderStockSchema);
