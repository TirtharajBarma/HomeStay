import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { PlatformSelect } from '../components/PlatformSelect';
import { Colors } from '../theme/colors';
import { Guest, Room } from '../types';

const SOURCE_OPTIONS = [
  { label: 'StayRide Public Web Link', value: 'StayRide link', icon: 'globe-outline' as const },
  { label: 'Walk-in Direct', value: 'Walk-in', icon: 'walk-outline' as const },
  { label: 'Phone Call', value: 'Phone', icon: 'call-outline' as const },
  { label: 'WhatsApp Chat', value: 'WhatsApp', icon: 'chatbubble-ellipses-outline' as const },
  { label: 'Repeat Returning Guest', value: 'Repeat booking', icon: 'repeat-outline' as const },
];

const GUEST_COUNT_OPTIONS = [
  { label: '1 Guest', value: '1', icon: 'person-outline' as const },
  { label: '2 Guests', value: '2', icon: 'people-outline' as const },
  { label: '3 Guests', value: '3', icon: 'people-outline' as const },
  { label: '4 Guests', value: '4', icon: 'people-outline' as const },
  { label: '5+ Guests', value: '5', icon: 'people-outline' as const },
];

export const NewBookingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId?: number } }, 'params'>>();
  const { guestId } = route.params || {};

  const { guests, rooms, createBooking, createGuest } = useStayRide();

  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [source, setSource] = useState('StayRide link');
  const [guestsCount, setGuestsCount] = useState('1');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);

  // Dates: default checkIn = today midnight, checkOut = in 2 days
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;
  const [checkIn, setCheckIn] = useState<number>(todayMs);
  const [checkOut, setCheckOut] = useState<number>(todayMs + 2 * dayMs);

  // Modals for selection
  const [guestPickerVisible, setGuestPickerVisible] = useState(false);
  const [sourcePickerVisible, setSourcePickerVisible] = useState(false);
  const [datesPickerVisible, setDatesPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (guestId) {
      const g = guests.find((item) => item.id === guestId);
      if (g) {
        setSelectedGuest(g);
        setGuestName(g.name);
        setPhone(g.phone);
      }
    }
  }, [guestId, guests]);

  const nights = Math.max(1, Math.round((checkOut - checkIn) / dayMs));

  useEffect(() => {
    if (selectedRoom) {
      setAmount(String(selectedRoom.price * nights));
    }
  }, [selectedRoom, checkIn, checkOut]);

  const fmtLong = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handleSelectGuest = (g: Guest) => {
    setSelectedGuest(g);
    setGuestName(g.name);
    setPhone(g.phone);
    setGuestPickerVisible(false);
  };

  const handleAdjustDays = (inOffset: number, duration: number) => {
    const inDate = todayMs + inOffset * dayMs;
    const outDate = inDate + duration * dayMs;
    setCheckIn(inDate);
    setCheckOut(outDate);
    setDatesPickerVisible(false);
  };

  const handleSave = async () => {
    if (submitting) return;
    const trimmedName = guestName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Guest name is required');
      return;
    }

    if (!selectedRoom) {
      Alert.alert('Required', 'Please select a room');
      return;
    }

    // Match by phone when one is entered; by name only if no phone and the name is unique.
    const digits = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
    const phoneDigits = digits(trimmedPhone);
    const sameName = guests.filter(
      (g) => g.name.toLowerCase() === trimmedName.toLowerCase()
    );
    const matchedGuest = phoneDigits
      ? guests.find((g) => digits(g.phone) === phoneDigits)
      : sameName.length === 1
      ? sameName[0]
      : undefined;

    if (!selectedGuest && !matchedGuest && !trimmedPhone) {
      Alert.alert('Required', 'Phone number is required for a new guest');
      return;
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }

    const parsedCount = Math.max(1, parseInt(guestsCount, 10) || 1);

    const knownGuest = selectedGuest || matchedGuest;
    setSubmitting(true);
    try {
      let finalGuestId = knownGuest ? knownGuest.id : 0;
      if (!finalGuestId) {
        const newGuest = await createGuest({
          name: trimmedName,
          phone: trimmedPhone,
          marketingConsent: false,
        });
        if (!newGuest || !newGuest.id) {
          throw new Error('Could not create the guest record');
        }
        finalGuestId = newGuest.id;
      }

      await createBooking({
        guestId: finalGuestId,
        guestName: trimmedName,
        phone: trimmedPhone || knownGuest?.phone || '',
        roomNumber: selectedRoom.number,
        checkIn,
        checkOut,
        guests: parsedCount,
        amount: parsedAmount,
        source: source || 'Walk-in',
        paid,
      });

      Alert.alert(
        'Booking Created',
        `Booking created for ${trimmedName} · Room ${selectedRoom.number}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Booking failed', err?.message || 'Could not save the booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="New booking" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Guest Input / Picker */}
        <Text style={styles.label}>Guest</Text>
        <View style={styles.guestInputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Guest name"
            placeholderTextColor={Colors.textSecondary}
            value={guestName}
            onChangeText={(txt) => {
              setGuestName(txt);
              if (selectedGuest && txt !== selectedGuest.name) {
                setSelectedGuest(null);
              }
            }}
          />
          <TouchableOpacity
            style={styles.pickerTriggerBtn}
            onPress={() => setGuestPickerVisible(true)}
          >
            <Text style={styles.pickerTriggerText}>Select Existing</Text>
          </TouchableOpacity>
        </View>

        {/* Phone */}
        <Text style={styles.label}>Phone number</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 00000 00000"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        {/* Room Picker */}
        <PlatformSelect
          label="Room"
          value={selectedRoom ? String(selectedRoom.id) : ''}
          options={rooms.map((r) => ({
            label: `Room ${r.number} · ${r.type}`,
            value: String(r.id),
            icon: 'bed-outline' as const,
            subLabel: `₹${r.price.toLocaleString()}/night · ${r.floor} · ${r.status}`,
          }))}
          onSelect={(roomIdStr) => {
            const rm = rooms.find((r) => String(r.id) === roomIdStr);
            if (rm) {
              setSelectedRoom(rm);
              setAmount(String(rm.price * nights));
            }
          }}
          placeholder="Select an available room"
        />

        {/* Dates */}
        <Text style={styles.label}>Stay Dates</Text>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setDatesPickerVisible(true)}
        >
          <Text style={styles.dropdownVal}>
            Check-in {fmtLong(checkIn)}
            {'\n'}Check-out {fmtLong(checkOut)} · {nights} night(s)
          </Text>
        </TouchableOpacity>

        {/* Number of Guests */}
        <PlatformSelect
          label="Number of Guests"
          value={guestsCount}
          options={GUEST_COUNT_OPTIONS}
          onSelect={setGuestsCount}
        />

        {/* Amount */}
        <Text style={styles.label}>Total Amount (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Source */}
        <PlatformSelect
          label="Booking Source"
          value={source}
          options={SOURCE_OPTIONS}
          onSelect={setSource}
        />

        {/* Payment Received Switch (matching Android paidCheck) */}
        <View style={styles.paymentSwitchRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.paymentSwitchTitle}>Payment received now</Text>
            <Text style={styles.paymentSwitchSub}>Mark booking as paid immediately</Text>
          </View>
          <Switch
            value={paid}
            onValueChange={setPaid}
            trackColor={{ false: Colors.divider, true: Colors.brandPrimaryLight }}
            thumbColor={paid ? Colors.brandPrimary : '#f4f3f4'}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={submitting}
        >
          <Text style={styles.saveBtnText}>{submitting ? 'Saving…' : 'Create booking'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Guest Picker Modal */}
      <Modal
        visible={guestPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGuestPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGuestPickerVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select a guest</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {guests.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.modalItem}
                  onPress={() => handleSelectGuest(g)}
                >
                  <Text style={styles.modalItemText}>{g.name}</Text>
                  <Text style={styles.modalItemSubtext}>{g.phone}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Quick Dates Picker Modal */}
      <Modal
        visible={datesPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatesPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDatesPickerVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Stay Dates</Text>
            {[
              { label: 'Today (1 night)', in: 0, dur: 1 },
              { label: 'Today (2 nights)', in: 0, dur: 2 },
              { label: 'Tomorrow (1 night)', in: 1, dur: 1 },
              { label: 'Tomorrow (2 nights)', in: 1, dur: 2 },
              { label: 'This Weekend (2 nights)', in: 2, dur: 2 },
              { label: 'Next Week (3 nights)', in: 4, dur: 3 },
            ].map((d, i) => (
              <TouchableOpacity
                key={i}
                style={styles.modalItem}
                onPress={() => handleAdjustDays(d.in, d.dur)}
              >
                <Text style={styles.modalItemText}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  guestInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pickerTriggerBtn: {
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickerTriggerText: {
    color: Colors.brandPrimaryDark,
    fontSize: 13,
    fontWeight: 'bold',
  },
  dropdownBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownVal: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  paymentSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentSwitchTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  paymentSwitchSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  modalItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
