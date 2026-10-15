import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { RadarView } from '../components/RadarView';
import { DriverItem } from '../components/DriverItem';
import { Pill } from '../components/Pill';
import { PlatformSelect } from '../components/PlatformSelect';
import { Colors } from '../theme/colors';
import { Driver, Guest, VehicleType } from '../types';

const TIMES = [
  '06:00 AM',
  '07:30 AM',
  '09:00 AM',
  '10:30 AM',
  '12:00 PM',
  '02:00 PM',
  '04:30 PM',
  '06:00 PM',
  '08:00 PM',
];

const TIME_OPTIONS = TIMES.map((t) => ({
  label: t,
  value: t,
  icon: 'time-outline' as const,
}));

// "hh:mm AM" on a local-midnight day -> epoch ms
// ponytail: uses device timezone; assumes the device is on IST like the server's check
const atTime = (dayMs: number, time: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!m) return NaN;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  const d = new Date(dayMs);
  d.setHours(h, Number(m[2]), 0, 0);
  return d.getTime();
};

const isFuture = (ms: number) => ms > Date.now();

const VEHICLE_TYPES: Array<{ label: string; value: VehicleType }> = [
  { label: 'Sedan (4 Seater)', value: 'Sedan' },
  { label: 'SUV (Bolero / Innova)', value: 'SUV' },
  { label: '7-Seater Maxi', value: '7-seater' },
  { label: '9-Seater Cruiser', value: '9-seater' },
];

const POPULAR_DESTINATIONS = [
  'Gangtok MG Marg',
  'Tsomgo Lake & Baba Mandir',
  'Nathula Pass Border',
  'Rumtek Monastery',
  'Bagdogra Airport (IXB)',
  'NJP Railway Station',
  'Darjeeling Mall Road',
  'Pelling Skywalk',
];

export const FindDriverScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { homestay, drivers, networkDrivers, guests, bookings, trips, bookDriver, createTrip } = useStayRide();

  // Mode: Nearby Mountain Pool vs My Private Fleet
  const [bookingMode, setBookingMode] = useState<'NEARBY' | 'MY_DRIVERS'>('NEARBY');

  const homestayTitle = homestay.name || homestay.location || 'My Homestay';
  const pickupOptions = useMemo(
    () => [
      { label: `${homestayTitle} (Homestay)`, value: homestayTitle, icon: 'home-outline' as const },
      { label: 'Current GPS location', value: 'Current GPS location', icon: 'navigate-outline' as const },
      { label: 'NJP Railway Station', value: 'NJP Railway Station', icon: 'train-outline' as const },
      { label: 'Bagdogra Airport (IXB)', value: 'Bagdogra Airport', icon: 'airplane-outline' as const },
      { label: 'Gangtok MG Marg Stand', value: 'Gangtok MG Marg', icon: 'location-outline' as const },
      { label: 'Darjeeling Mall Stand', value: 'Darjeeling Mall Stand', icon: 'location-outline' as const },
      { label: 'Pelling Market Stand', value: 'Pelling Market', icon: 'location-outline' as const },
    ],
    [homestayTitle]
  );

  const [panel, setPanel] = useState<'INPUT' | 'SEARCHING' | 'RESULTS'>('INPUT');
  const [pickup, setPickup] = useState(homestayTitle);

  // Multi-stop destination list
  const [destinations, setDestinations] = useState<string[]>(['Gangtok MG Marg']);

  // Round trip state
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDateIdx, setReturnDateIdx] = useState(1);
  const [returnTime, setReturnTime] = useState(TIMES[6]); // 04:30 PM default

  // Schedule & Vehicle
  const [selectedTime, setSelectedTime] = useState(TIMES[2]); // 09:00 AM default
  const [selectedDateIdx, setSelectedDateIdx] = useState(1);
  const [vehicleType, setVehicleType] = useState<VehicleType>('SUV');
  const [passengers, setPassengers] = useState(2);

  // Passenger selection
  // Default passenger: a currently checked-in guest, otherwise nobody
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(
    () =>
      guests.find((g) =>
        bookings.some((b) => b.status === 'CHECKED_IN' && (b.guestId === g.id || b.phone === g.phone))
      ) || null
  );
  const [customGuestName, setCustomGuestName] = useState('');
  const [customGuestPhone, setCustomGuestPhone] = useState('');
  const [isCustomPassenger, setIsCustomPassenger] = useState(false);

  // Driver modals
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [broadcastSuccessModalVisible, setBroadcastSuccessModalVisible] = useState(false);
  const [bookedSuccessModalVisible, setBookedSuccessModalVisible] = useState(false);
  const [lastCreatedTrip, setLastCreatedTrip] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // blocks double taps before the re-render

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const dates = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return {
      ms: d.getTime(),
      label:
        i === 0
          ? `Today · ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
          : i === 1
          ? `Tomorrow · ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    };
  });

  // Multi-stop handlers
  const handleAddDestination = () => {
    if (destinations.length >= 6) {
      Alert.alert('Limit Reached', 'You can add up to 6 mountain stop destinations.');
      return;
    }
    setDestinations([...destinations, '']);
  };

  const handleUpdateDestination = (idx: number, text: string) => {
    const updated = [...destinations];
    updated[idx] = text;
    setDestinations(updated);
  };

  const handleRemoveDestination = (idx: number) => {
    if (destinations.length <= 1) {
      setDestinations(['']);
      return;
    }
    const updated = destinations.filter((_, i) => i !== idx);
    setDestinations(updated);
  };

  const handleQuickAddPreset = (dest: string) => {
    const emptyIdx = destinations.findIndex((d) => !d.trim());
    if (emptyIdx !== -1) {
      handleUpdateDestination(emptyIdx, dest);
    } else {
      if (destinations.length >= 6) {
        Alert.alert('Limit Reached', 'You can add up to 6 mountain stop destinations.');
        return;
      }
      setDestinations([...destinations, dest]);
    }
  };

  // Passenger data resolver
  const getPassengerInfo = () => {
    if (isCustomPassenger || !selectedGuest) {
      return {
        name: customGuestName.trim(),
        phone: customGuestPhone.trim(),
      };
    }
    return {
      name: selectedGuest.name,
      phone: selectedGuest.phone,
    };
  };

  const cleanDestinationSummary = () => {
    const valid = destinations.filter((d) => d.trim());
    if (valid.length === 0) return 'Local Sightseeing';
    return valid.join(' ➔ ');
  };

  // Returns an error message, or null when the request is valid
  const validateRequest = (): string | null => {
    const passenger = getPassengerInfo();
    if (!passenger.name) return 'Please select a guest or enter the passenger name.';
    if (passenger.phone.replace(/[^0-9]/g, '').length < 10) return 'Please enter a valid passenger mobile number.';
    if (destinations.every((d) => !d.trim())) return 'Please add at least one drop location or sightseeing spot.';
    const pickupAt = atTime(dates[selectedDateIdx].ms, selectedTime);
    if (!isFuture(pickupAt)) return 'Pickup date and time is in the past. Please choose a later time.';
    if (isRoundTrip) {
      const returnAt = atTime(dates[returnDateIdx].ms, returnTime);
      if (!returnAt) return 'Please choose a return date and time for the round trip.';
      if (!(returnAt > pickupAt)) return 'Return date and time must be after the pickup.';
    }
    return null;
  };

  // Validates, warns on a likely duplicate, and takes the submit lock; false = do not submit
  const beginSubmit = async (): Promise<boolean> => {
    if (submittingRef.current) return false;
    const error = validateRequest();
    if (error) {
      Alert.alert('Check Trip Details', error);
      return false;
    }
    submittingRef.current = true;
    const digits = getPassengerInfo().phone.replace(/[^0-9]/g, '').slice(-10);
    const day = dates[selectedDateIdx].ms;
    const duplicate = trips.some(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'CANCELLED' &&
        t.phone.replace(/[^0-9]/g, '').slice(-10) === digits &&
        new Date(t.date).toDateString() === new Date(day).toDateString()
    );
    const proceed =
      !duplicate ||
      (await new Promise<boolean>((resolve) =>
        Alert.alert(
          'Possible Duplicate',
          'An open cab trip already exists for this guest on this date. Book another one anyway?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Book Anyway', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        )
      ));
    if (!proceed) {
      submittingRef.current = false;
      return false;
    }
    setSubmitting(true);
    return true;
  };

  const endSubmit = () => {
    submittingRef.current = false;
    setSubmitting(false);
  };

  // Searching Nearby Drivers
  const handleStartSearch = () => {
    const error = validateRequest();
    if (error) {
      Alert.alert('Check Trip Details', error);
      return;
    }

    setPanel('SEARCHING');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPanel('RESULTS');
    }, 2400);
  };

  // Broadcast to all nearby drivers
  const handleBroadcastToAll = async () => {
    if (!(await beginSubmit())) return;
    const passenger = getPassengerInfo();
    const formattedDestinations = destinations
      .filter((d) => d.trim())
      .map((addr, order) => ({ address: addr, order }));

    try {
      const trip = await createTrip({
        guestName: passenger.name,
        phone: passenger.phone,
        pickup: pickup === 'Current GPS location' ? homestay.location || homestay.name : pickup,
        destination: cleanDestinationSummary(),
        destinations: formattedDestinations,
        isRoundTrip,
        returnDate: isRoundTrip ? dates[returnDateIdx].ms : undefined,
        returnTime: isRoundTrip ? returnTime : undefined,
        date: dates[selectedDateIdx].ms,
        time: selectedTime,
        passengers,
        vehicleType,
        source: 'NEARBY_BROADCAST',
      });
      setLastCreatedTrip(trip);
      setBroadcastSuccessModalVisible(true);
    } catch (err: any) {
      Alert.alert('Broadcast Failed', err?.message || 'Could not broadcast request. Please try again.');
    } finally {
      endSubmit();
    }
  };

  // Request quote from specific nearby driver
  const handleRequestQuoteFromDriver = async (driver: Driver) => {
    if (!(await beginSubmit())) return;
    const passenger = getPassengerInfo();
    const formattedDestinations = destinations
      .filter((d) => d.trim())
      .map((addr, order) => ({ address: addr, order }));

    try {
      const trip = await createTrip({
        guestName: passenger.name,
        phone: passenger.phone,
        pickup: pickup === 'Current GPS location' ? homestay.location || homestay.name : pickup,
        destination: cleanDestinationSummary(),
        destinations: formattedDestinations,
        isRoundTrip,
        returnDate: isRoundTrip ? dates[returnDateIdx].ms : undefined,
        returnTime: isRoundTrip ? returnTime : undefined,
        date: dates[selectedDateIdx].ms,
        time: selectedTime,
        passengers,
        vehicleType,
        assignedDriverId: driver.id,
        assignedDriverName: driver.name,
        source: 'MANUAL_OWNER',
      });
      setSelectedDriver(driver);
      setLastCreatedTrip(trip);
      setProfileModalVisible(false);
      setBroadcastSuccessModalVisible(true);
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Could not send quote request to driver.');
    } finally {
      endSubmit();
    }
  };

  // Direct assign to host's private driver (My Drivers)
  const handleDirectAssignMyDriver = async (driver: Driver) => {
    if (!(await beginSubmit())) return;
    const passenger = getPassengerInfo();
    const formattedDestinations = destinations
      .filter((d) => d.trim())
      .map((addr, order) => ({ address: addr, order }));
    try {
      const trip = await bookDriver({
        guestName: passenger.name,
        phone: passenger.phone,
        pickup: pickup === 'Current GPS location' ? homestay.location || homestay.name : pickup,
        destination: cleanDestinationSummary(),
        destinations: formattedDestinations,
        isRoundTrip,
        returnDate: isRoundTrip ? dates[returnDateIdx].ms : undefined,
        returnTime: isRoundTrip ? returnTime : undefined,
        date: dates[selectedDateIdx].ms,
        time: selectedTime,
        passengers,
        vehicleType: driver.vehicleType || vehicleType,
        driverId: driver.id,
      });
      setSelectedDriver(driver);
      setLastCreatedTrip(trip);
      setBookedSuccessModalVisible(true);
    } catch (err: any) {
      Alert.alert('Assignment Failed', err?.message || 'Could not assign private driver.');
    } finally {
      endSubmit();
    }
  };

  const shareWhatsappSlip = () => {
    const passenger = getPassengerInfo();
    const cleanPhone = passenger.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const dateText = dates[selectedDateIdx].label;
    const destText = cleanDestinationSummary();
    const driverName = selectedDriver?.name || 'Assigned Driver';
    const vehicle = selectedDriver ? `${selectedDriver.vehicle} (${selectedDriver.plate || 'Hill Permit'})` : vehicleType;

    const msg =
      `*STAYRIDE MOUNTAIN CAB CONFIRMATION*\n` +
      `--------------------------------\n` +
      `Namaste ${passenger.name},\n` +
      `Your cab from *${homestay.name}* is booked.\n\n` +
      `🚗 *Driver:* ${driverName}\n` +
      `🚙 *Vehicle:* ${vehicle}\n` +
      `📍 *Pickup:* ${pickup}\n` +
      `🎯 *Route:* ${destText}\n` +
      `🔄 *Round Trip:* ${isRoundTrip ? `Yes (Return: ${dates[returnDateIdx].label} ${returnTime})` : 'One-way'}\n` +
      `📅 *Date & Time:* ${dateText} at ${selectedTime}\n\n` +
      `Your host will share the fare and advance details once confirmed.\n` +
      `Have a safe mountain journey! 🏔️`;

    const url = `whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'WhatsApp is not installed on this device');
    });
  };

  return (
    <View style={styles.container}>
      <Header title="Book a Cab" onBack={() => navigation.goBack()} />

      {/* Top Mode Switcher */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[styles.modeToggleBtn, bookingMode === 'NEARBY' && styles.modeToggleBtnActive]}
          onPress={() => {
            setBookingMode('NEARBY');
            setPanel('INPUT');
          }}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={bookingMode === 'NEARBY' ? '#FFFFFF' : Colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.modeToggleText, bookingMode === 'NEARBY' && styles.modeToggleTextActive]}>
            Nearby Mountain Pool
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeToggleBtn, bookingMode === 'MY_DRIVERS' && styles.modeToggleBtnActive]}
          onPress={() => {
            setBookingMode('MY_DRIVERS');
            setPanel('INPUT');
          }}
        >
          <Ionicons
            name="car"
            size={16}
            color={bookingMode === 'MY_DRIVERS' ? '#FFFFFF' : Colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.modeToggleText, bookingMode === 'MY_DRIVERS' && styles.modeToggleTextActive]}>
            My Fleet ({drivers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* PANEL 1: INPUT FORM */}
      {panel === 'INPUT' && (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {bookingMode === 'NEARBY' ? 'Mountain Driver Network' : 'Homestay Private Fleet'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {bookingMode === 'NEARBY'
                ? 'Send your itinerary to 50+ vetted mountain drivers. Drivers quote their best fare; you confirm and earn commission.'
                : 'Directly dispatch one of your registered homestay drivers without bidding.'}
            </Text>

            {/* Pickup Point */}
            <Text style={styles.label}>1. Start / Pickup Location</Text>
            <PlatformSelect
              label="Select pickup"
              value={pickup}
              options={pickupOptions}
              onSelect={setPickup}
            />

            {/* Multi-Destination Builder */}
            <View style={styles.destHeaderRow}>
              <Text style={styles.label}>2. Drop Destinations & Sightseeing Stops</Text>
              <TouchableOpacity style={styles.addStopBtn} onPress={handleAddDestination}>
                <Ionicons name="add-circle" size={16} color={Colors.brandPrimaryDark} style={{ marginRight: 4 }} />
                <Text style={styles.addStopText}>+ Add Stop</Text>
              </TouchableOpacity>
            </View>

            {destinations.map((dest, idx) => (
              <View key={idx} style={styles.stopInputRow}>
                <View style={styles.stopBadge}>
                  <Text style={styles.stopBadgeText}>{idx === 0 ? 'Drop' : `Stop ${idx + 1}`}</Text>
                </View>
                <TextInput
                  style={styles.stopTextInput}
                  placeholder={idx === 0 ? 'e.g. Gangtok MG Marg or Tsomgo Lake' : 'e.g. Baba Mandir or Rumtek'}
                  value={dest}
                  onChangeText={(text) => handleUpdateDestination(idx, text)}
                  placeholderTextColor={Colors.textSecondary}
                />
                {destinations.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeStopBtn}
                    onPress={() => handleRemoveDestination(idx)}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.statusRed} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Quick Destination Pills */}
            <Text style={styles.quickPresetTitle}>Quick Sightseeing Presets:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              {POPULAR_DESTINATIONS.map((dest, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.presetChip}
                  onPress={() => handleQuickAddPreset(dest)}
                >
                  <Ionicons name="location-sharp" size={12} color={Colors.brandPrimary} style={{ marginRight: 4 }} />
                  <Text style={styles.presetChipText}>{dest}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Round Trip Toggle */}
            <View style={styles.roundTripRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roundTripTitle}>Round Trip Return?</Text>
                <Text style={styles.roundTripSubtitle}>
                  Includes waiting and same-day or multi-day return transfer
                </Text>
              </View>
              <Switch
                value={isRoundTrip}
                onValueChange={(on) => {
                  setIsRoundTrip(on);
                  if (on && returnDateIdx < selectedDateIdx) setReturnDateIdx(selectedDateIdx);
                }}
                trackColor={{ false: '#CBD5E1', true: Colors.brandPrimaryLight }}
                thumbColor={isRoundTrip ? Colors.brandPrimaryDark : '#F8FAFC'}
              />
            </View>

            {/* Return Date/Time fields if Round Trip */}
            {isRoundTrip && (
              <View style={styles.returnSection}>
                <Text style={styles.label}>Return Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                  {dates.map((d, idx) => {
                    const active = returnDateIdx === idx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.dateChip, active && styles.chipActive]}
                        onPress={() => setReturnDateIdx(idx)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <PlatformSelect
                  label="Estimated Return Time"
                  value={returnTime}
                  options={TIME_OPTIONS}
                  onSelect={setReturnTime}
                />
              </View>
            )}

            {/* Start Ride Date */}
            <Text style={styles.label}>3. Start Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
              {dates.map((d, idx) => {
                const active = selectedDateIdx === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dateChip, active && styles.chipActive]}
                    onPress={() => {
                      setSelectedDateIdx(idx);
                      if (returnDateIdx < idx) setReturnDateIdx(idx);
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <PlatformSelect
              label="Pickup Time"
              value={selectedTime}
              options={TIME_OPTIONS}
              onSelect={setSelectedTime}
            />

            {/* Vehicle Type */}
            <Text style={styles.label}>4. Vehicle Preference & Seats</Text>
            <View style={styles.vehicleTypeGrid}>
              {VEHICLE_TYPES.map((v) => {
                const active = vehicleType === v.value;
                return (
                  <TouchableOpacity
                    key={v.value}
                    style={[styles.vehicleTypeCard, active && styles.vehicleTypeCardActive]}
                    onPress={() => setVehicleType(v.value)}
                  >
                    <Ionicons
                      name="car-outline"
                      size={18}
                      color={active ? Colors.brandPrimaryDark : Colors.textSecondary}
                    />
                    <Text style={[styles.vehicleTypeText, active && styles.vehicleTypeTextActive]}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Passenger Assignment */}
            <Text style={styles.label}>5. Passenger (Guest)</Text>
            <View style={styles.passengerToggleRow}>
              <TouchableOpacity
                style={[styles.passOptionBtn, !isCustomPassenger && styles.passOptionBtnActive]}
                onPress={() => setIsCustomPassenger(false)}
              >
                <Text style={[styles.passOptionText, !isCustomPassenger && styles.passOptionTextActive]}>
                  From Homestay Guests
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passOptionBtn, isCustomPassenger && styles.passOptionBtnActive]}
                onPress={() => setIsCustomPassenger(true)}
              >
                <Text style={[styles.passOptionText, isCustomPassenger && styles.passOptionTextActive]}>
                  Manual Entry
                </Text>
              </TouchableOpacity>
            </View>

            {!isCustomPassenger ? (
              guests.length === 0 ? (
                <View style={styles.emptyGuestBox}>
                  <Text style={styles.emptyGuestText}>No registered guests found in your homestay database.</Text>
                  <TouchableOpacity onPress={() => setIsCustomPassenger(true)}>
                    <Text style={styles.switchManualText}>Enter passenger details manually ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                  {guests.map((g) => {
                    const active = selectedGuest?.id === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.guestChip, active && styles.guestChipActive]}
                        onPress={() => setSelectedGuest(g)}
                      >
                        <Text style={[styles.guestChipName, active && styles.guestChipNameActive]}>
                          {g.name}
                        </Text>
                        <Text style={styles.guestChipPhone}>{g.phone}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )
            ) : (
              <View style={styles.customPassInputs}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Passenger Full Name"
                  value={customGuestName}
                  onChangeText={setCustomGuestName}
                  placeholderTextColor={Colors.textSecondary}
                />
                <TextInput
                  style={[styles.textInput, { marginTop: 8 }]}
                  placeholder="WhatsApp Mobile Number (e.g. 9832012345)"
                  value={customGuestPhone}
                  onChangeText={setCustomGuestPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            )}

            {/* Main Action Button */}
            {bookingMode === 'NEARBY' ? (
              <TouchableOpacity style={styles.searchBtn} onPress={handleStartSearch}>
                <Ionicons name="search" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.searchBtnText}>Search Nearby Mountain Drivers</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.subheadText}>Select Driver from Your Fleet ({drivers.length}):</Text>
                {drivers.length === 0 ? (
                  <View style={styles.emptyFleetCard}>
                    <Ionicons name="car-outline" size={36} color="#94A3B8" />
                    <Text style={styles.emptyFleetTitle}>No Private Drivers Added Yet</Text>
                    <Text style={styles.emptyFleetDesc}>
                      You haven't added private drivers to your homestay fleet yet. Switch to "Nearby Mountain Pool" or add your driver now.
                    </Text>
                    <TouchableOpacity
                      style={styles.addDriverFleetBtn}
                      onPress={() => navigation.navigate('MyDrivers')}
                    >
                      <Text style={styles.addDriverFleetBtnText}>+ Add My Driver</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  drivers.map((drv) => (
                    <View key={drv.id} style={styles.privateDriverCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.privateDriverName}>{drv.name}</Text>
                        <Text style={styles.privateDriverVehicle}>
                          {drv.vehicle} · {drv.vehicleType} · {drv.phone}
                        </Text>
                        <Pill
                          type="driver"
                          value={drv.available ? 'AVAILABLE' : 'ON TRIP'}
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.directAssignBtn}
                        onPress={() => handleDirectAssignMyDriver(drv)}
                        disabled={submitting}
                      >
                        <Text style={styles.directAssignBtnText}>
                          {submitting ? 'Assigning...' : 'Assign & Book'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* PANEL 2: RADAR SEARCHING ANIMATION */}
      {panel === 'SEARCHING' && (
        <View style={styles.radarContainer}>
          <RadarView size={240} />
          <Text style={styles.radarTitle}>Searching 50+ Mountain Drivers…</Text>
          <Text style={styles.radarSubtitle}>
            Matching vehicle types, ratings, and mountain permits along {cleanDestinationSummary()}
          </Text>
        </View>
      )}

      {/* PANEL 3: RESULTS (BROADCAST + INDIVIDUAL DRIVERS) */}
      {panel === 'RESULTS' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultsBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsCount}>
                {networkDrivers.length} verified drivers in mountain pool
              </Text>
              <Text style={styles.resultsSort}>Nearest first · Vetted mountain hill routes</Text>
            </View>
            <TouchableOpacity style={styles.searchAgainBtn} onPress={() => setPanel('INPUT')}>
              <Text style={styles.searchAgainText}>Edit Route</Text>
            </TouchableOpacity>
          </View>

          {/* Broadcast to All Card */}
          <View style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <View style={styles.broadcastIconBadge}>
                <Ionicons name="flash" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.broadcastTitle}>Broadcast to All Nearby Drivers</Text>
                <Text style={styles.broadcastSubtitle}>
                  5-minute response window · Drivers submit quotes immediately
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.broadcastActionBtn, submitting && { opacity: 0.6 }]}
              onPress={handleBroadcastToAll}
              disabled={submitting}
            >
              <Ionicons name="radio" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.broadcastActionBtnText}>
                {submitting ? 'Broadcasting...' : '⚡ Broadcast Request to Pool'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: Individual Drivers */}
          <Text style={styles.individualDriversHeader}>Or Select a Specific Driver to Request Quote:</Text>

          {networkDrivers.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No pool drivers available right now</Text>
              <Text style={styles.cardSubtitle}>
                You can still broadcast the itinerary or use your own private drivers.
              </Text>
            </View>
          )}

          {networkDrivers.map((driver) => (
            <DriverItem
              key={driver.id}
              driver={driver}
              onPress={() => {
                setSelectedDriver(driver);
                setProfileModalVisible(true);
              }}
              onBook={() => handleRequestQuoteFromDriver(driver)}
            />
          ))}
        </ScrollView>
      )}

      {/* MODAL 1: Driver Profile */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileModalVisible(false)}
        >
          <View style={styles.profileCard}>
            {selectedDriver && (
              <>
                <View style={styles.profileAvatar}>
                  <Text style={styles.avatarInitials}>
                    {selectedDriver.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.profileName}>{selectedDriver.name}</Text>
                <Text style={styles.profileRating}>★ {selectedDriver.rating} rating · Verified Driver</Text>
                <Text style={styles.profileVehicle}>
                  {selectedDriver.vehicle} · {selectedDriver.vehicleType} · {selectedDriver.seats} seats
                </Text>
                <Text style={styles.profileArea}>{selectedDriver.area}</Text>
                <Text style={styles.profileTrips}>
                  Hill Routes: {selectedDriver.trips?.join(' · ') || 'Sikkim & Darjeeling'}
                </Text>

                <View style={{ marginVertical: 12 }}>
                  <Pill
                    type="driver"
                    value={selectedDriver.available ? 'AVAILABLE NOW' : 'ON A TRIP'}
                  />
                </View>

                <TouchableOpacity
                  style={styles.bookNowBtn}
                  onPress={() => handleRequestQuoteFromDriver(selectedDriver)}
                  disabled={submitting}
                >
                  <Text style={styles.bookNowBtnText}>
                    {submitting ? 'Sending...' : `Request Quote from ${selectedDriver.name}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setProfileModalVisible(false)}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL 2: Broadcast / Quote Request Sent Modal */}
      <Modal
        visible={broadcastSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBroadcastSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="paper-plane" size={32} color="#2563EB" />
            </View>
            <Text style={styles.successTitle}>Cab Request Broadcasted!</Text>
            <Text style={styles.successMessage}>
              Your itinerary has been dispatched to {selectedDriver ? selectedDriver.name : 'all nearby mountain drivers'}.
              {'\n\n'}
              ⏱ <Text style={{ fontWeight: 'bold' }}>5-minute quote response window.</Text>
              {'\n'}
              When drivers quote their fare, it will appear under <Text style={{ fontWeight: 'bold' }}>Cabs ➔ Requested</Text> with your dynamic homestay commission automatically calculated.
            </Text>

            <TouchableOpacity
              style={styles.doneBtnPrimary}
              onPress={() => {
                setBroadcastSuccessModalVisible(false);
                navigation.navigate('Cabs');
              }}
            >
              <Text style={styles.doneBtnPrimaryText}>View in Cabs Tab</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Private Driver Booked & WhatsApp Share Modal */}
      <Modal
        visible={bookedSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBookedSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.successIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
            </View>
            <Text style={[styles.successTitle, { color: '#16A34A' }]}>Cab Booked Successfully!</Text>
            <Text style={styles.successMessage}>
              Driver <Text style={{ fontWeight: 'bold' }}>{selectedDriver?.name}</Text> is confirmed for {getPassengerInfo().name}.
              {'\n\n'}
              Route: {cleanDestinationSummary()}
              {'\n'}
              {dates[selectedDateIdx].label} at {selectedTime}
            </Text>

            <TouchableOpacity style={styles.whatsappBtn} onPress={shareWhatsappSlip}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.whatsappBtnText}>Send WhatsApp Ticket to Guest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setBookedSuccessModalVisible(false);
                navigation.navigate('Cabs');
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 6,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: Colors.brandPrimary,
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
  },
  destHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  addStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addStopText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  stopInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stopBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  stopTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  removeStopBtn: {
    marginLeft: 8,
    padding: 4,
  },
  quickPresetTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 4,
  },
  presetScroll: {
    marginVertical: 4,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  roundTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roundTripTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  roundTripSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  returnSection: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.brandPrimary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  vehicleTypeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  vehicleTypeCardActive: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandPrimaryLight,
  },
  vehicleTypeText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  vehicleTypeTextActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: 'bold',
  },
  passengerToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
  },
  passOptionBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  passOptionBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  passOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  passOptionTextActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: 'bold',
  },
  guestChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  guestChipActive: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandPrimaryLight,
  },
  guestChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  guestChipNameActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: 'bold',
  },
  guestChipPhone: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyGuestBox: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyGuestText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  switchManualText: {
    fontSize: 12,
    color: Colors.brandPrimaryDark,
    fontWeight: 'bold',
    marginTop: 6,
  },
  customPassInputs: {
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  searchBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  subheadText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyFleetCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyFleetTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  emptyFleetDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  addDriverFleetBtn: {
    marginTop: 12,
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addDriverFleetBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  privateDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  privateDriverName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  privateDriverVehicle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginVertical: 4,
  },
  directAssignBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  directAssignBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  radarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  radarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 24,
  },
  radarSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  resultsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultsCount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  resultsSort: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchAgainBtn: {
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchAgainText: {
    color: Colors.brandPrimaryDark,
    fontSize: 13,
    fontWeight: 'bold',
  },
  broadcastCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  broadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  broadcastIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  broadcastTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400E',
  },
  broadcastSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  broadcastActionBtn: {
    flexDirection: 'row',
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastActionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  individualDriversHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  profileRating: {
    fontSize: 14,
    color: Colors.statusOrange,
    fontWeight: 'bold',
    marginTop: 4,
  },
  profileVehicle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  profileArea: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  profileTrips: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  bookNowBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  bookNowBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeBtn: {
    paddingVertical: 10,
    marginTop: 4,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  doneBtnPrimary: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  whatsappBtn: {
    flexDirection: 'row',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 10,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  doneBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
