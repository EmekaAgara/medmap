function deviceFingerprint(req, res, next) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection.remoteAddress ||
    null;

  req.device = {
    ip,
    userAgent: req.headers['user-agent'] || '',
    deviceId: req.headers['x-device-id'] || null,
  };

  next();
}

module.exports = deviceFingerprint;

