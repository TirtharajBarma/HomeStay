import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../data/api';

// Push is best-effort: no permission, an emulator, Expo Go, or a build without FCM/APNs
// credentials all end in `null` and the app keeps working on its 30s sync.

let registeredToken: string | null = null;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Native module unavailable (e.g. web)
}

/** Ask (politely, once the user is signed in) and send this device's Expo push token to StayRide. */
export async function registerForPush(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Trip updates',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await api.post('/push-token', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    registeredToken = token;
    return token;
  } catch (e) {
    console.warn('[StayRide] push registration skipped:', (e as Error)?.message);
    return null;
  }
}

/** Remove this device's token on the server (call while the session is still valid). */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await api.delete('/push-token', { token });
  } catch {
    // Server prunes dead tokens itself; never block sign out on this
  }
}

export type PushData = { type?: string; reference?: string; tripId?: number };

/** Calls `onTap` with the notification data whenever the user opens a StayRide notification. */
export function onPushTap(onTap: (data: PushData) => void): () => void {
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      onTap((last.notification.request.content.data || {}) as PushData);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      onTap((res.notification.request.content.data || {}) as PushData);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
