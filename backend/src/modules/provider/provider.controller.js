const { success, fail } = require('../../utils/responses');
const providerService = require('./provider.service');
const cloudinary = require('../../config/cloudinary');

async function list(req, res) {
  try {
    const providers = await providerService.listProviders(req.query);
    return success(res, providers);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getOne(req, res) {
  try {
    const provider = await providerService.getProvider(req.params.id);
    if (!provider) return fail(res, 'Provider not found', 404);
    return success(res, provider);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getMyProvider(req, res) {
  try {
    const provider = await providerService.getMine(req.user.id);
    return success(res, provider);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function upsertMyProvider(req, res) {
  try {
    const provider = await providerService.upsertMine(req.user.id, req.body);
    return success(res, provider, 'Provider listing saved');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function uploadMyProviderAvatar(req, res) {
  try {
    if (!req.file) {
      return fail(res, 'No file uploaded', 400);
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'medmap/provider-avatars',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'faces' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
          resource_type: 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const provider = await providerService.updateMineAvatar(req.user.id, uploadResult.secure_url);
    return success(res, provider, 'Provider image updated');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function claim(req, res) {
  try {
    const result = await providerService.claimProvider({
      userId: req.user.id,
      providerId: req.params.id,
    });
    return success(res, result, 'Claim request submitted');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function listPendingModeration(req, res) {
  try {
    const data = await providerService.listPendingModeration(req.query);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function moderate(req, res) {
  try {
    const { action, reason } = req.body;
    const data = await providerService.moderateProvider({
      providerId: req.params.id,
      adminId: req.user.id,
      action,
      reason,
    });
    return success(res, data, `Provider ${action}d`);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  list,
  getOne,
  getMyProvider,
  upsertMyProvider,
  uploadMyProviderAvatar,
  claim,
  listPendingModeration,
  moderate,
};
