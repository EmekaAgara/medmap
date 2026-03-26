const { success, fail } = require('../../utils/responses');
const medicalService = require('./medical.service');

async function getMyProfile(req, res) {
  try {
    const data = await medicalService.getOrCreateProfile(req.user.id);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function upsertMyProfile(req, res) {
  try {
    const data = await medicalService.upsertProfile(req.user.id, req.body || {});
    return success(res, data, 'Medical profile saved');
  } catch (err) {
    return fail(res, err.message, err.status || 500, err.details ?? null);
  }
}

async function getMyTimeline(req, res) {
  try {
    const data = await medicalService.getTimeline(req.user.id, req.query || {});
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  getMyProfile,
  upsertMyProfile,
  getMyTimeline,
};

