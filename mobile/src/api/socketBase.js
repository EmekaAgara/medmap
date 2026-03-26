import API_BASE_URL from './baseUrl';

/**
 * Socket.IO server origin (scheme + host + port, no path).
 *
 * 1) EXPO_PUBLIC_SOCKET_URL — set when WS host differs from REST or you use a non-standard API path.
 * 2) Else strip `/api/v1` from the REST base (same host as HTTP API).
 */
export function getSocketBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  return API_BASE_URL.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
}
