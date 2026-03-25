const { success, fail } = require('../../utils/responses');
const userService = require('./user.service');
const cloudinary = require('../../config/cloudinary');

async function me(req, res) {
  try {
    const user = await userService.getProfile(req.user.id);
    return success(res, user);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function updateMe(req, res) {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return success(res, user, 'Profile updated');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function submitKyc(req, res) {
  try {
    const user = await userService.submitKyc(req.user.id, req.body);
    return success(res, user, 'KYC submitted');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return fail(res, 'No file uploaded', 400);
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'medmap/avatars',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
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

    const user = await userService.updateAvatar(req.user.id, uploadResult.secure_url);
    return success(res, user, 'Avatar updated');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function deleteAccount(req, res) {
  try {
    await userService.deleteAccount(req.user.id);
    return success(res, null, 'Account deleted');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function deleteAvatar(req, res) {
  try {
    const user = await userService.updateAvatar(req.user.id, null);
    return success(res, user, 'Avatar removed');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function getSecurity(req, res) {
  try {
    const currentDeviceId = req.headers['x-device-id'] || null;
    const data = await userService.getSecurityInfo(req.user.id, currentDeviceId);
    return success(res, data);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function revokeSession(req, res) {
  try {
    const { deviceId } = req.params;
    if (!deviceId) return fail(res, 'Device ID is required', 400);
    await userService.revokeSession(req.user.id, deviceId);
    return success(res, null, 'Session revoked');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function revokeOtherSessions(req, res) {
  try {
    const currentDeviceId = req.headers['x-device-id'] || req.body.currentDeviceId || null;
    await userService.revokeOtherSessions(req.user.id, currentDeviceId);
    return success(res, null, 'All other sessions have been signed out');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function requestEmailChange(req, res) {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return fail(res, 'New email is required', 400);
    await userService.requestEmailChange(req.user.id, newEmail);
    return success(res, null, 'Verification code sent to your current email address');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyOldEmail(req, res) {
  try {
    const { code } = req.body;
    if (!code) return fail(res, 'Verification code is required', 400);
    await userService.verifyOldEmailAndSendNew(req.user.id, code);
    return success(res, null, 'Verified. A confirmation code has been sent to your new email address');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyNewEmail(req, res) {
  try {
    const { code } = req.body;
    if (!code) return fail(res, 'Verification code is required', 400);
    const user = await userService.verifyNewEmailAndCommit(req.user.id, code);
    return success(res, user, 'Email updated successfully');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function requestPhoneChange(req, res) {
  try {
    const { newPhone } = req.body;
    if (!newPhone) return fail(res, 'New phone number is required', 400);
    await userService.requestPhoneChange(req.user.id, newPhone);
    return success(res, null, 'Verification code sent to your email address');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyPhoneChange(req, res) {
  try {
    const { code } = req.body;
    if (!code) return fail(res, 'Verification code is required', 400);
    const user = await userService.verifyPhoneChange(req.user.id, code);
    return success(res, user, 'Phone number updated successfully');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function updateMyLocation(req, res) {
  try {
    const { latitude, longitude } = req.body;
    const user = await userService.updateLocation(req.user.id, { latitude, longitude });
    return success(res, user, 'Location updated');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function updateExpoPushToken(req, res) {
  try {
    const { expoPushToken } = req.body;
    const user = await userService.updateExpoPushToken(req.user.id, expoPushToken);
    return success(res, user, 'Push token saved');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  me,
  updateMe,
  submitKyc,
  uploadAvatar,
  deleteAvatar,
  deleteAccount,
  getSecurity,
  revokeSession,
  revokeOtherSessions,
  requestEmailChange,
  verifyOldEmail,
  verifyNewEmail,
  requestPhoneChange,
  verifyPhoneChange,
  updateMyLocation,
  updateExpoPushToken,
};
