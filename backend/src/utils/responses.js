function success(res, data = null, message = 'Success', status = 200) {
  return res.status(status).json({ message, data });
}

function fail(res, message = 'Bad request', status = 400, details = null) {
  return res.status(status).json({ message, details });
}

module.exports = {
  success,
  fail,
};

