import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";

function NotificationDeepLinks() {
  const router = useRouter();
  useEffect(() => {
    const isExpoGo =
      Constants.appOwnership === "expo" ||
      Constants.executionEnvironment === "storeClient";
    if (isExpoGo) return undefined;

    const Notifications = require("expo-notifications");
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data || {};
        if (data.type === "message" && data.conversationId) {
          router.push({
            pathname: "/(app)/provider-chat",
            params: { conversationId: String(data.conversationId) },
          });
        }
        if (
          (data.type === "appointment" || data.type === "appointment_reminder") &&
          data.appointmentId
        ) {
          router.push({
            pathname: "/(app)/appointments/[id]",
            params: { id: String(data.appointmentId) },
          });
        }
      }
    );
    return () => sub.remove();
  }, [router]);
  return null;
}

export default function AppLayout() {
  return (
    <>
      <NotificationDeepLinks />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
        <Stack.Screen name="change-contact" options={{ headerShown: false }} />
        <Stack.Screen name="security" options={{ headerShown: false }} />
        <Stack.Screen name="transaction-pin" options={{ headerShown: false }} />
        <Stack.Screen name="kyc" options={{ headerShown: false }} />
        <Stack.Screen name="provider-listing" options={{ headerShown: false }} />
        <Stack.Screen name="provider-chat" options={{ headerShown: false }} />
        <Stack.Screen name="book-appointment" options={{ headerShown: false }} />
        <Stack.Screen name="appointments" options={{ headerShown: false }} />
        <Stack.Screen name="provider-appointments" options={{ headerShown: false }} />
        <Stack.Screen name="orders" options={{ headerShown: false }} />
        <Stack.Screen name="provider-orders" options={{ headerShown: false }} />
        <Stack.Screen name="provider-shop" options={{ headerShown: false }} />
        <Stack.Screen name="wallet" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
