import * as SecureStore from 'expo-secure-store';
import API_BASE_URL from './baseUrl';

const ACCESS_TOKEN_KEY = 'medmap_access_token';
const REFRESH_TOKEN_KEY = 'medmap_refresh_token';
const DEVICE_ID_KEY = 'medmap_device_id';

export async function saveAuthSession({ accessToken, refreshToken, deviceId }) {
  try {
    if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    if (deviceId) await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  } catch {
    // ignore secure store failures
  }
}

export async function loadAuthSession() {
  try {
    const [accessToken, refreshToken, deviceId] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(DEVICE_ID_KEY),
    ]);
    return { accessToken, refreshToken, deviceId };
  } catch {
    return { accessToken: null, refreshToken: null, deviceId: null };
  }
}

export async function clearAuthSession() {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(DEVICE_ID_KEY),
    ]);
  } catch {
    // ignore
  }
}

// Shared helper: attempt token refresh and return new tokens
async function attemptRefresh() {
  const { refreshToken, deviceId } = await loadAuthSession();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Send as header so deviceFingerprint middleware picks it up
      ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
    },
    // Also send in body for redundancy
    body: JSON.stringify({ refreshToken, deviceId }),
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok && data?.data?.accessToken) {
    const refreshed = data.data;
    await saveAuthSession({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      // preserve existing deviceId if the server doesn't return a new one
      deviceId: refreshed.deviceId || deviceId,
    });
    return refreshed.accessToken;
  }

  throw new Error(data.message || 'Session expired. Please log in again.');
}

// Build request headers, always attaching deviceId as X-Device-Id
async function buildHeaders(accessToken, contentType = 'application/json') {
  const { deviceId } = await loadAuthSession();
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (deviceId) headers['X-Device-Id'] = deviceId;
  return headers;
}

export async function apiUpload(path, { formData, token } = {}) {
  const makeRequest = async (accessToken) => {
    // No Content-Type — fetch sets multipart/form-data with boundary automatically
    const headers = await buildHeaders(accessToken, null);
    const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await makeRequest(token);

  if (res.status === 401 && token) {
    const newToken = await attemptRefresh();
    ({ res, data } = await makeRequest(newToken));
  }

  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const makeRequest = async (accessToken) => {
    const headers = await buildHeaders(accessToken);
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await makeRequest(token);

  // If 401 and we had a token, silently refresh and retry once
  if (res.status === 401 && token) {
    const newToken = await attemptRefresh();
    ({ res, data } = await makeRequest(newToken));
  }

  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}
