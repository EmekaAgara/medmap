import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'medmap_wallet_checkout_v1';

/**
 * Persist checkout context and open full-screen in-app WebView (see wallet/checkout-webview).
 * Do not store auth tokens here — use useAuth() on the checkout screen.
 */
export async function beginInAppCheckout(router, session) {
  const payload = {
    ...session,
    startedAt: Date.now(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  router.push('/(app)/wallet/checkout-webview');
}

export async function readCheckoutSession() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearCheckoutSession() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
