const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// ── Token helpers ──────────────────────────────────────────────────────────────

function getToken()        { return localStorage.getItem('medmap_admin_token'); }
function getRefreshToken() { return localStorage.getItem('medmap_admin_refresh_token'); }
function getDeviceId()     { return localStorage.getItem('medmap_admin_device_id'); }

function setToken(token)   { localStorage.setItem('medmap_admin_token', token); }

function clearSession() {
  localStorage.removeItem('medmap_admin_token');
  localStorage.removeItem('medmap_admin_refresh_token');
  localStorage.removeItem('medmap_admin_device_id');
  localStorage.removeItem('medmap_admin_user');
}

// ── Refresh logic (runs at most once at a time) ────────────────────────────────

let refreshPromise = null;

async function tryRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    const deviceId     = getDeviceId();

    if (!refreshToken || !deviceId) throw new Error('No refresh token');

    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, deviceId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.message || 'Refresh failed');

    setToken(data.data.accessToken);
    // Update refresh token if the server rotates it
    if (data.data.refreshToken) {
      localStorage.setItem('medmap_admin_refresh_token', data.data.refreshToken);
    }
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ── Core request function ──────────────────────────────────────────────────────

export async function apiRequest(path, { method = 'GET', body } = {}, _retry = false) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token expired — attempt one silent refresh then retry.
  // Only try if we actually had a token (i.e. this is an expired session,
  // not a failed login attempt where no token exists yet).
  if (res.status === 401 && !_retry && getToken()) {
    try {
      await tryRefresh();
      return apiRequest(path, { method, body }, true); // retry once
    } catch {
      clearSession();
      // Redirect to login; the React router will pick this up via AuthProvider
      window.location.href = '/login';
      return;
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return data;
}
