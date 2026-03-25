const { success, fail } = require('../../utils/responses');
const authService = require('./auth.service');
const passwordService = require('./password.service');
const { buildOtpEmailHtml, sendEmail } = require('../../utils/notifications');

async function register(req, res) {
  try {
    const { email, phone, password, fullName, accountType } = req.body;
    if (!email || !phone || !password || !fullName) {
      return fail(res, 'Missing required fields', 400);
    }
    const user = await authService.register({ email, phone, password, fullName, accountType });
    return success(res, user, 'Registration successful', 201);
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function login(req, res) {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return fail(res, 'Missing credentials', 400);
    }
    const data = await authService.login({
      emailOrPhone,
      password,
      device: {
        ip: req.device?.ip,
        userAgent: req.device?.userAgent,
        deviceId: req.device?.deviceId,
      },
    });
    return success(res, data, 'Login successful');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function requestLoginOtp(req, res) {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) return fail(res, 'Missing email or phone', 400);
    await authService.requestLoginOtp({ emailOrPhone });
    return success(res, null, 'OTP sent');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function loginWithOtp(req, res) {
  try {
    const { emailOrPhone, code } = req.body;
    if (!emailOrPhone || !code) return fail(res, 'Missing credentials', 400);
    const data = await authService.loginWithOtp({
      emailOrPhone,
      code,
      device: {
        ip: req.device?.ip,
        userAgent: req.device?.userAgent,
        deviceId: req.device?.deviceId,
      },
    });
    return success(res, data, 'Login successful');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function resendVerificationEmail(req, res) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, 'Email is required', 400);
    await authService.resendVerificationEmail({ email });
    return success(res, null, 'Verification code sent');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return fail(res, 'Missing email or code', 400);
    const data = await authService.verifyEmail({ email, code });
    return success(res, data, 'Email verified');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, 'Missing email', 400);
    const { user, code } = await passwordService.requestPasswordReset({ email });
    const html = buildOtpEmailHtml({
      title: 'Reset your MedMap password',
      intro: 'Use the code below to reset your MedMap password. This code will expire in 10 minutes.',
      code,
      footer: 'If you did not request a password reset, you can safely ignore this email.',
    });
    await sendEmail(user.email, 'Reset your MedMap password', html);
    return success(res, null, 'Password reset code sent');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return fail(res, 'Missing email, code, or new password', 400);
    }
    await passwordService.resetPassword({ email, code, newPassword });
    return success(res, null, 'Password reset successful');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken, deviceId: bodyDeviceId } = req.body;
    if (!refreshToken) return fail(res, 'Missing refresh token', 400);

    // deviceId comes from the x-device-id header (via deviceFingerprint middleware)
    // OR from the request body (mobile clients send it there)
    const deviceId = req.device?.deviceId || bodyDeviceId || null;

    const data = await authService.refresh({
      refreshToken,
      device: { deviceId },
    });
    return success(res, data, 'Token refreshed');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function logout(req, res) {
  try {
    await authService.logout({
      userId: req.user.id,
      deviceId: req.device?.deviceId,
    });
    return success(res, null, 'Logged out');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return fail(res, 'Current password and new password are required', 400);
    }
    await authService.changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
    });
    return success(res, null, 'Password changed successfully');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function setupPin(req, res) {
  try {
    const { pin } = req.body;
    if (!pin) return fail(res, 'PIN is required', 400);
    await authService.setupTransactionPin({ userId: req.user.id, pin });
    return success(res, null, 'Transaction PIN set');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function changePin(req, res) {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) return fail(res, 'Current PIN and new PIN are required', 400);
    await authService.changePin({ userId: req.user.id, currentPin, newPin });
    return success(res, null, 'Transaction PIN changed successfully');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

async function verifyPin(req, res) {
  try {
    const { pin } = req.body;
    if (!pin) return fail(res, 'PIN is required', 400);
    await authService.verifyPin({ userId: req.user.id, pin });
    return success(res, null, 'PIN verified');
  } catch (err) {
    return fail(res, err.message, err.status || 500);
  }
}

module.exports = {
  register,
  login,
  requestLoginOtp,
  loginWithOtp,
  refresh,
  logout,
  resendVerificationEmail,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  setupPin,
  changePin,
  verifyPin,
  changePassword,
};

