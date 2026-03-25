const { success, fail } = require('../../utils/responses');
const creditService = require('./credit.service');

async function getScore(req, res) {
  try {
    const score = await creditService.getCurrentScore(req.user.id);
    return success(res, score);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  getScore,
};

