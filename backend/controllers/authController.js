const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role || 'staff' };
}

async function register(req, res, next) {
  try {
    const { token, name, email, password } = req.body;
    if (!token) {
      return res.status(403).json({ message: 'New accounts must be created from an admin invite link.' });
    }
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const invite = await User.findOne({
      inviteToken: token,
      inviteExpiresAt: { $gt: new Date() }
    }).select('_id invitedBy isActive role');

    if (!invite) {
      return res.status(404).json({ message: 'This invite link is invalid or has expired.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'staff',
      invitedBy: invite._id,
      inviteToken: null,
      inviteExpiresAt: null,
      isActive: true
    });

    await User.updateOne({ _id: invite._id }, { $unset: { inviteToken: 1, inviteExpiresAt: 1 } });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function createInvite(req, res, next) {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + (1000 * 60 * 60 * 24 * 7));
    const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/invite/${token}`;

    const adminUser = await User.findById(req.user.id).select('_id');
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    await User.findOneAndUpdate(
      { _id: adminUser._id },
      { $set: { inviteToken: token, inviteExpiresAt: expiresAt } },
      { new: true }
    );

    res.status(201).json({
      token,
      inviteUrl,
      expiresAt,
      message: 'Share this link with the person you want to give access.'
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, createInvite };
