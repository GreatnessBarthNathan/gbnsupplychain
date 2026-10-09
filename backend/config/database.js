const mongoose = require('mongoose');
const User = require('../models/User');

async function ensureDefaultAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gbn.local').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    await User.updateMany({ role: { $exists: false } }, { $set: { role: 'staff' } });
    return { email: adminEmail, created: false };
  }

  const passwordHash = await require('bcryptjs').hash(adminPassword, 12);
  const adminUser = await User.create({
    name: 'System Administrator',
    email: adminEmail,
    passwordHash,
    role: 'admin',
    isActive: true
  });

  console.log(`Created default admin account: ${adminUser.email} / password: ${adminPassword}`);
  return { email: adminUser.email, created: true };
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
  await ensureDefaultAdmin();
}

module.exports = connectDatabase;
