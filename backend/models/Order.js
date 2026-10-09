const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    funnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', required: true },
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 24 },
    whatsapp: { type: String, required: true, trim: true, maxlength: 24 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    quantity: { type: Number, required: true, min: 1, max: 100 },
    total: { type: Number, required: true, min: 0 },
    stage: {
      type: String,
      enum: ['new', 'activated', 'in_transit', 'at_state', 'delivered', 'transferred', 'failed', 'returning', 'returned'],
      default: 'new',
      index: true
    },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', default: null },
    stockRestocked: { type: Boolean, default: false },
    remittanceServiceCharge: { type: Number, min: 0, default: null },
    remittedAmount: { type: Number, min: 0, default: null },
    remittedAt: { type: Date, default: null },
    redirectedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    redirectedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    stageHistory: [
      {
        stage: { type: String, required: true },
        note: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

orderSchema.index({ owner: 1, createdAt: -1 });
orderSchema.index({ owner: 1, stage: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
