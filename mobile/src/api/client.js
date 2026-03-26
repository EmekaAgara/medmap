import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import API_BASE_URL from "./baseUrl";

export const MEDMAP_AUTH_REFRESH_EVENT = "medmap:auth-refreshed";

const ACCESS_TOKEN_KEY = "medmap_access_token";
const REFRESH_TOKEN_KEY = "medmap_refresh_token";
const DEVICE_ID_KEY = "medmap_device_id";

export async function saveAuthSession({ accessToken, refreshToken, deviceId }) {
  try {
    if (accessToken)
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken)
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
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

/** Single in-flight refresh so parallel requests (e.g. verify poll + nav) don’t stampede /auth/refresh. */
let refreshPromise = null;

// Shared helper: attempt token refresh and return new access token (updates SecureStore)
async function attemptRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken, deviceId } = await loadAuthSession();
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(deviceId ? { "X-Device-Id": deviceId } : {}),
      },
      body: JSON.stringify({ refreshToken, deviceId }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.data?.accessToken) {
      const refreshed = data.data;
      const nextDeviceId = refreshed.deviceId || deviceId;
      await saveAuthSession({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        deviceId: nextDeviceId,
      });
      try {
        const raw = await AsyncStorage.getItem("medmap_auth");
        if (raw) {
          const parsed = JSON.parse(raw);
          await AsyncStorage.setItem(
            "medmap_auth",
            JSON.stringify({
              ...parsed,
              token: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? parsed.refreshToken,
              deviceId: nextDeviceId ?? parsed.deviceId,
            }),
          );
        }
      } catch {
        /* ignore */
      }
      DeviceEventEmitter.emit(MEDMAP_AUTH_REFRESH_EVENT, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        deviceId: nextDeviceId,
      });
      return refreshed.accessToken;
    }

    throw new Error(data.message || "Session expired. Please log in again.");
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Prefer SecureStore access token over the caller’s `token` (React context lags behind refresh).
 */
async function buildHeaders(fallbackAccessToken, contentType = "application/json") {
  const { accessToken: stored, deviceId } = await loadAuthSession();
  const accessToken = stored || fallbackAccessToken;
  const headers = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (deviceId) headers["X-Device-Id"] = deviceId;
  return headers;
}

export async function apiUpload(path, { formData, token } = {}) {
  const makeRequest = async (accessToken) => {
    // No Content-Type — fetch sets multipart/form-data with boundary automatically
    const headers = await buildHeaders(accessToken, null);
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await makeRequest(token);

  if (res.status === 401) {
    const { refreshToken } = await loadAuthSession();
    if (refreshToken) {
      await attemptRefresh();
      ({ res, data } = await makeRequest(null));
    }
  }

  if (!res.ok) throw new Error(data.message || "Upload failed");
  return data;
}

export async function apiRequest(path, { method = "GET", body, token } = {}) {
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

  if (res.status === 401) {
    const { refreshToken } = await loadAuthSession();
    if (refreshToken) {
      await attemptRefresh();
      ({ res, data } = await makeRequest(null));
    }
  }

  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}
