import { Alert } from 'react-native';
import { Guest } from '../types';

type Ask = (data: { guestId?: number; guestName: string; guestPhone: string }) => Promise<{ sent: boolean; status: string }>;

// StayRide's server sends the WhatsApp message from the company number; we only confirm to the owner.
// Returns true when the guest was actually messaged.
export async function askGuestForCab(ask: Ask, guest: Guest): Promise<boolean> {
  try {
    const res = await ask({ guestId: guest.id, guestName: guest.name, guestPhone: guest.phone });
    if (res.sent) {
      Alert.alert('Request sent', `We sent ${guest.name} a WhatsApp message with a link to request a cab. Their request will appear in Guest Inquiries.`);
      return true;
    }
    Alert.alert('WhatsApp not connected', 'Messaging is not switched on for this account yet, so nothing was sent to the guest.');
  } catch (e: any) {
    Alert.alert('Could not send request', e?.message || 'Please try again.');
  }
  return false;
}
