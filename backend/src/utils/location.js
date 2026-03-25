function buildGeoPoint(longitude, latitude) {
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    throw new Error('Invalid coordinates');
  }
  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

module.exports = {
  buildGeoPoint,
};

