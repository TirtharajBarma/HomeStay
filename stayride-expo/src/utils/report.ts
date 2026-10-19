import { Alert } from 'react-native';
import { ActionOutcome } from '../data/store';

export const reportOutcome = (outcome: ActionOutcome, title: string, message: string): boolean => {
  if (!outcome.ok) {
    Alert.alert("Couldn't save", outcome.error || 'Please try again.');
    return false;
  }
  // Every save is confirmed by the server (nothing is queued offline), so ok means saved
  Alert.alert(title, message);
  return true;
};

// "Sign out of all devices": ends every session on the server, then this device signs out too.
export const confirmLogoutAll = (logoutAllDevices: () => Promise<ActionOutcome>, afterSignOut?: () => Promise<void> | void) => {
  Alert.alert('Sign out of all devices', 'This signs you out on every phone where you are logged in, including this one.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out everywhere',
      style: 'destructive',
      onPress: async () => {
        const outcome = await logoutAllDevices();
        if (!outcome.ok) {
          Alert.alert('Could not sign out other devices', outcome.error || 'Please try again.');
          return;
        }
        await afterSignOut?.();
      },
    },
  ]);
};
