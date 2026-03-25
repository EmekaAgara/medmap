const crypto = require('crypto');
const fetch = require('node-fetch');
const env = require('../config/env');
const logger = require('../config/logger');

function hasCredentials() {
  return !!(env.interswitch.clientId && env.interswitch.clientSecret);
}

function buildBasicAuth() {
  return Buffer.from(`${env.interswitch.clientId}:${env.interswitch.clientSecret}`).toString('base64');
}

async function interswitchRequest(path, { method = 'GET', body } = {}) {
  if (!hasCredentials()) {
    throw Object.assign(new Error('Interswitch credentials are not configured'), { status: 500 });
  }

  const url = `${env.interswitch.baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${buildBasicAuth()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error('Interswitch API error', { path, status: res.status, data });
    throw Object.assign(new Error(data.message || 'Interswitch API error'), { status: res.status });
  }
  return data;
}

function verifyInterswitchWebhookSignature(rawBody, signature) {
  if (!env.interswitch.webhookSecret || !signature) return false;
  const hash = crypto
    .createHmac('sha256', env.interswitch.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

module.exports = {
  hasCredentials,
  interswitchRequest,
  verifyInterswitchWebhookSignature,
};
