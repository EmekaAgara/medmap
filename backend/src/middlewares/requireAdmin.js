const { fail } = require('../utils/responses');

module.exports = function requireAdmin(req, res, next) {
  if (!req.user?.roles?.includes('admin')) {
    return fail(res, 'Admin access required', 403);
  }
  next();
};
