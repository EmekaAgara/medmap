import Constants from 'expo-constants';

/**
 * REST API base URL (must include `/api/v1` if your server mounts routes there).
 *
 * Priority:
 *   1. EXPO_PUBLIC_API_URL — required for production / EAS builds; use https in prod.
 *   2. EXPO_PUBLIC_ANDROID_EMULATOR=1 — uses 10.0.2.2 (Android emulator → host machine).
 *   3. __DEV__ — LAN IP from Expo dev server (physical device + Expo Go).
 *   4. http://localhost:4000/api/v1 — iOS Simulator and web fallback.
 */
function resolveApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    const base = fromEnv.replace(/\/$/, '');
    if (/\/api\/v1$/i.test(base)) return base;
    return `${base}/api/v1`;
  }

  // Android Emulator: localhost inside the VM is not your dev machine.
  if (__DEV__ && process.env.EXPO_PUBLIC_ANDROID_EMULATOR === '1') {
    const port = process.env.EXPO_PUBLIC_API_PORT?.trim() || '4000';
    return `http://10.0.2.2:${port}/api/v1`;
  }

  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest?.debuggerHost ||
      Constants.manifest2?.extra?.expoClient?.hostUri;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      const port = process.env.EXPO_PUBLIC_API_PORT?.trim() || '4000';
      return `http://${host}:${port}/api/v1`;
    }
  }

  const fallbackPort = process.env.EXPO_PUBLIC_API_PORT?.trim() || '4000';
  return `http://localhost:${fallbackPort}/api/v1`;
}

const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  // One-line trace: confirms device/simulator sees the same host the API runs on.
  // eslint-disable-next-line no-console
  console.log('[MedMap] API_BASE_URL =', API_BASE_URL);
}

export default API_BASE_URL;
