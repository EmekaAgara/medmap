const User = require('../../models/User');
const OtpToken = require('../../models/OtpToken');
const { hashPassword, comparePassword } = require('../../utils/crypto');

async function requestPasswordReset({ email }) {
  const emailValue = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: emailValue });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpToken.create({
    user: user._id,
    email: user.email,
    purpose: 'password_reset',
    codeHash,
    expiresAt,
  });

  return { user, code };
}

async function resetPassword({ email, code, newPassword }) {
  const emailValue = String(email).trim().toLowerCase();
  const codeValue = String(code).trim();
  const user = await User.findOne({ email: emailValue });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const token = await OtpToken.findOne({
    user: user._id,
    purpose: 'password_reset',
    email: user.email,
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!token || token.expiresAt < new Date() || token.consumedAt) {
    const error = new Error('Invalid or expired code');
    error.status = 400;
    throw error;
  }

  const matches = await comparePassword(codeValue, token.codeHash);
  if (!matches) {
    const error = new Error('Invalid or expired code');
    error.status = 400;
    throw error;
  }

  token.consumedAt = new Date();
  await token.save();

  const SECURE_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!SECURE_PASSWORD.test(newPassword)) {
    const error = new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number');
    error.status = 400;
    throw error;
  }

  const passwordHash = await hashPassword(newPassword);
  user.passwordHash = passwordHash;
  await user.save();

  return { id: user._id, email: user.email };
}

module.exports = {
  requestPasswordReset,
  resetPassword,
};

