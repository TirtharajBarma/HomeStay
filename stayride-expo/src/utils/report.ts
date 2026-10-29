import { Alert } from 'react-native';
import { ActionOutcome } from '../data/store';

export const reportOutcome = (outcome: ActionOutcome, title: string, message: string): boolean => {
  if (!outcome.ok) {
    Alert.alert("Couldn't save", outcome.error || 'Please try again.');
    return false;
  }
  const displayMsg = outcome.synced
    ? message
    : `${message}\n\n(Saved offline on device — will automatically sync with backend when connection returns).`;
  Alert.alert(title, displayMsg);
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
