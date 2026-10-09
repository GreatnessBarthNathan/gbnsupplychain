const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' });
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub)
      .select('_id name email role isActive invitedBy')
      .populate('invitedBy', '_id role');
    if (!user || !user.isActive) return res.status(401).json({ message: 'Your account is no longer available.' });
    if (user.role === 'admin') {
      req.workspaceOwnerId = user._id;
    } else if (user.invitedBy?.role === 'admin') {
      req.workspaceOwnerId = user.invitedBy._id;
    } else {
      return res.status(403).json({ message: 'Your account is not linked to an active workspace.' });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
    next(error);
  }
}

function requireRole(...allowedRoles) {
  const roles = new Set(allowedRoles.flat());
  return function checkRole(req, res, next) {
    if (!req.user || !roles.has(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this action.' });
    }
    next();
  };
}

module.exports = requireAuth;
module.exports.requireRole = requireRole;
