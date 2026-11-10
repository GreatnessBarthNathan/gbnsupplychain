const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function getAuthContext(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: { status: 401, message: 'Sign in to continue.' } };
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return { error: { status: 401, message: 'Your session has expired. Please sign in again.' } };
    }
    throw error;
  }

  const user = await User.findById(payload.sub)
      .select('_id name email role isActive invitedBy')
      .populate('invitedBy', '_id role');
  if (!user || !user.isActive) {
    return { error: { status: 401, message: 'Your account is no longer available.' } };
  }
  if (user.role === 'admin') return { user, workspaceOwnerId: user._id };
  if (user.invitedBy?.role === 'admin') {
    return { user, workspaceOwnerId: user.invitedBy._id };
  }
  return { error: { status: 403, message: 'Your account is not linked to an active workspace.' } };
}

async function requireAuth(req, res, next) {
  try {
    const context = await getAuthContext(req);
    if (context.error) return res.status(context.error.status).json({ message: context.error.message });
    req.workspaceOwnerId = context.workspaceOwnerId;
    req.user = context.user;
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const context = await getAuthContext(req);
    if (!context.error) {
      req.workspaceOwnerId = context.workspaceOwnerId;
      req.user = context.user;
    }
    next();
  } catch (error) {
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
module.exports.optional = optionalAuth;
