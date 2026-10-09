const mongoose = require('mongoose');

const riderStockTransferSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    funnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['in_transit', 'received'], default: 'in_transit', index: true },
    sentAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RiderStockTransfer', riderStockTransferSchema);
