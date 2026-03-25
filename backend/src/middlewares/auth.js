const env = require('../config/env');
const logger = require('../config/logger');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

function auth(required = true) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (!required) return next();
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select('isBanned isDeactivated').lean();
      if (!user || user.isBanned || user.isDeactivated) {
        return res.status(401).json({ message: 'Account is not active' });
      }
      req.user = {
        id: decoded.sub,
        roles: decoded.roles || [],
      };
      return next();
    } catch (err) {
      logger.warn('Invalid access token', { error: err.message });
      if (!required) return next();
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

function requireRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const hasRole = (req.user.roles || []).some((r) => roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = {
  auth,
  requireRoles,
};

