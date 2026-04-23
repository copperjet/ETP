import { Redirect, Stack } from 'expo-router';
import { View, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { OfflineBanner } from '../../components/ui';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerPushToken(userId: string, schoolId: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    const deviceId = `${Platform.OS}-${Date.now()}`;

    await (supabase as any)
      .from('push_tokens')
      .upsert({
        user_id: userId,
        school_id: schoolId,
        device_id: deviceId,
        push_token: pushToken,
        platform: Platform.OS,
      }, { onConflict: 'user_id,device_id' });
  } catch {
    // Non-fatal — push token registration failure should not break the app
  }
}

export default function AppLayout() {
  const { user, isReady } = useAuthStore();
  const notifListener = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    registerPushToken(user.id, user.schoolId);

    notifListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // Notification received while app is in foreground — badge updates handled by handler above
    });

    return () => {
      notifListener.current?.remove();
    };
  }, [user?.id]);

  if (isReady && !user) return <Redirect href="/(auth)/school-code" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineBanner />
    </View>
  );
}
