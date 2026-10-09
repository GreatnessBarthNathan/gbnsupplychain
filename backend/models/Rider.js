const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 24 },
    accessToken: { type: String, required: true, unique: true, select: false },
    city: { type: String, required: true, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rider', riderSchema);
