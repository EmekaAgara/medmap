function pagination(defaultLimit = 20, maxLimit = 100) {
  return (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    let limit = parseInt(req.query.limit || String(defaultLimit), 10);
    if (Number.isNaN(limit) || limit <= 0) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;
    const skip = (page - 1) * limit;

    req.pagination = { page, limit, skip };
    next();
  };
}

module.exports = pagination;

