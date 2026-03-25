import API_BASE_URL from './baseUrl';

/** Socket.IO origin (strip `/api/v1`). */
export function getSocketBaseUrl() {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
}
