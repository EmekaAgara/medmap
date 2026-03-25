import Constants from 'expo-constants';

/**
 * Resolves the API base URL.
 *
 * Priority order:
 *  1. EXPO_PUBLIC_API_URL env var  (set in .env for staging/prod or manual override)
 *  2. Auto-detected from Expo dev-server host  (works on real devices in Expo Go)
 *  3. Localhost fallback  (works in simulators only)
 */
function resolveApiBaseUrl() {
  // 1. Explicit override always wins
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. In development, derive IP from the Expo dev-server connection.
  //    Constants.expoConfig.hostUri looks like "192.168.x.x:8081"
  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest?.debuggerHost ||
      Constants.manifest2?.extra?.expoClient?.hostUri;

    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip the :8081 port
      return `http://${host}:4000/api/v1`;
    }
  }

  // 3. Fallback (simulator or web)
  return 'http://localhost:4000/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

export default API_BASE_URL;
