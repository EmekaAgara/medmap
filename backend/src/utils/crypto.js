const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function hashPin(pin) {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

async function comparePin(pin, hash) {
  return bcrypt.compare(pin, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
  hashPin,
  comparePin,
};

