const mongoose = require('mongoose');

const funnelSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    productName: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1200, default: '' },
    images: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'NGN', maxlength: 3 },
    pixelId: { type: String, trim: true, default: '', maxlength: 32 },
    slug: { type: String, unique: true, index: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Funnel', funnelSchema);
