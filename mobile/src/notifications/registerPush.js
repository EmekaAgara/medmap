import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiRequest } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers for push notifications and saves Expo token on the user profile.
 */
export async function registerPushAndSync(accessToken) {
  if (!accessToken) return;
  if (!Device.isDevice) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[MedMap] Push: physical device required. Simulator/emulator will not receive appointment or message pushes.'
      );
    }
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(
      '[MedMap] Push: add "extra.eas.projectId" in app.json after `eas init` so release builds get reliable Expo push tokens.'
    );
  }
  const tokenRes = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const expoPushToken = tokenRes.data;
  if (!expoPushToken) return;

  await apiRequest('/users/me/push-token', {
    method: 'PUT',
    token: accessToken,
    body: { expoPushToken },
  });
}
