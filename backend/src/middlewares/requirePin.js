const { comparePin } = require('../utils/crypto');
const User = require('../models/User');
const { fail } = require('../utils/responses');

/**
 * Middleware that protects financial actions.
 * Expects the client to send the transaction PIN in the `x-transaction-pin` header.
 */
module.exports = async function requirePin(req, res, next) {
  try {
    const pin = req.headers['x-transaction-pin'];
    if (!pin) return fail(res, 'Transaction PIN is required to perform this action', 403);

    const user = await User.findById(req.user.id).select('transactionPinHash');
    if (!user) return fail(res, 'User not found', 404);

    if (!user.transactionPinHash) {
      return fail(res, 'Please set a transaction PIN before performing financial actions', 403);
    }

    const valid = await comparePin(String(pin), user.transactionPinHash);
    if (!valid) return fail(res, 'Incorrect transaction PIN', 403);

    next();
  } catch (err) {
    return fail(res, 'PIN verification failed', 500);
  }
};
