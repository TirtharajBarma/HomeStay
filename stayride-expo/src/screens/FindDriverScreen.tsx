import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { api } from '../data/api';
import { Header } from '../components/Header';
import { FeatureLocked } from '../components/FeatureLocked';
import { PlatformSelect } from '../components/PlatformSelect';
import { Colors, Radii, Shadows } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';
import { vehicleOptions, vehicleLabel } from '../utils/vehicle';
import { RangeCalendar } from '../components/RangeCalendar';
import { LocationPicker } from '../components/LocationPicker';
import { ownFleetFeeFor } from '../data/platformConfig';
import { Driver, Guest, VehicleType } from '../types';

type IconName = keyof typeof Ionicons.glyphMap;

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
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const MANUAL = '__manual__';
const MAX_STOPS = 6;

const Section: React.FC<{ icon: IconName; title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ icon, title, right, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={16} color={Colors.brandPrimaryDark} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      {right}
    </View>
    {children}
  </View>
);

export const FindDriverScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { homestay, drivers, guests, bookings, trips, bookDriver, createTrip, features, config } = useStayRide();
  // Pickup times, booking window, presets and vehicle classes are the admin's settings (from the server)
  const timeOptions = config.pickupTimes.map((t) => ({ label: t, value: t, icon: 'time-outline' as const }));
  // Leaving this form ends the submission: a reopened form gets a fresh Idempotency-Key
  useEffect(() => () => api.clearIdempotencyKeys('/trips'), []);
  const platformLocked = features?.platformDispatch === false;

  // StayRide drivers (quotes) vs the owner's own fleet (direct assign)
  const [bookingMode, setBookingMode] = useState<'NEARBY' | 'MY_DRIVERS'>('NEARBY');

  // Pickup is the homestay as saved on the backend; the owner can override it with free text
  const homestayTitle = homestay.name || homestay.location || 'My Homestay';
  const homestayPickup = [homestay.name, homestay.location].filter(Boolean).join(', ') || homestayTitle;

  const [customPickup, setCustomPickup] = useState('');
  const [editPickup, setEditPickup] = useState(false);
  const pickup = customPickup.trim() || homestayPickup;
  // Map pin for a pickup away from the homestay (sent with the trip so the driver can navigate)
  const [pickupPin, setPickupPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupMapVisible, setPickupMapVisible] = useState(false);
  const pinFields = customPickup.trim() && pickupPin ? { pickupLat: pickupPin.latitude, pickupLng: pickupPin.longitude } : {};

  // Multi-stop destination list (starts empty: no pre-filled places)
  const [destinations, setDestinations] = useState<string[]>(['']);

  // Schedule & Vehicle
  const [selectedTime, setSelectedTime] = useState(() => (config.pickupTimes.includes('09:00 AM') ? '09:00 AM' : config.pickupTimes[0]));
  // Pickup day (local midnight); defaults to tomorrow
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  });
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>(() =>
    vehicleOptions().some((v) => v.value === 'SUV') ? 'SUV' : vehicleOptions()[0].value
  );
  // Fare the owner agreed with their own driver; StayRide's own-fleet fee is taken from it as the advance
  const [ownFare, setOwnFare] = useState('');
  const [passengers, setPassengers] = useState(2);
  const [fleetDriverId, setFleetDriverId] = useState<Driver['id'] | null>(null);
  const fleetDriver = drivers.find((d) => d.id === fleetDriverId) || null;

  // Seats of the vehicle that will actually go: the chosen own driver's, else the requested class
  const seatsFor = (type?: string | null) => vehicleOptions().find((v) => v.value === type)?.seats || 4;
  const maxSeats = bookingMode === 'MY_DRIVERS' && fleetDriver ? seatsFor(fleetDriver.vehicleType) : seatsFor(vehicleType);
  const passengerOptions = Array.from({ length: maxSeats }, (_, i) => ({
    label: `${i + 1} ${i === 0 ? 'passenger' : 'passengers'}`,
    value: String(i + 1),
    icon: 'people-outline' as const,
  }));

  // Passenger selection
  // Default passenger: a currently checked-in guest, otherwise nobody
  const checkedIn = (g: Guest) => bookings.some((b) => b.status === 'CHECKED_IN' && (b.guestId === g.id || b.phone === g.phone));
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(() => guests.find(checkedIn) || null);
  const [customGuestName, setCustomGuestName] = useState('');
  const [customGuestPhone, setCustomGuestPhone] = useState('');
  const [isCustomPassenger, setIsCustomPassenger] = useState(() => guests.length === 0);
  const guestOptions = [
    ...[...guests]
      .sort((a, b) => Number(checkedIn(b)) - Number(checkedIn(a)))
      .map((g) => ({
        label: g.name,
        value: String(g.id),
        subLabel: `${checkedIn(g) ? 'Staying now · ' : ''}${g.phone}`,
        icon: (checkedIn(g) ? 'bed' : 'person-outline') as IconName,
      })),
    { label: 'Someone else', value: MANUAL, subLabel: 'Type the name and number', icon: 'create-outline' as IconName },
  ];

  // Success modals
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [broadcastSuccessModalVisible, setBroadcastSuccessModalVisible] = useState(false);
  const [bookedSuccessModalVisible, setBookedSuccessModalVisible] = useState(false);
  const [lastCreatedTrip, setLastCreatedTrip] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // blocks double taps before the re-render

  const fmtDay = (ms: number) => {
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const label = new Date(ms).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return ms === t0 ? `Today · ${label}` : ms === t0 + 86400000 ? `Tomorrow · ${label}` : label;
  };
  const horizonEnd = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + config.bookingHorizonDays).getTime();
  })();

  // Multi-stop handlers
  const handleAddDestination = () => {
    if (destinations.length >= MAX_STOPS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_STOPS} stops.`);
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
    setDestinations(destinations.filter((_, i) => i !== idx));
  };

  const handleQuickAddPreset = (dest: string) => {
    if (destinations.includes(dest)) return;
    const emptyIdx = destinations.findIndex((d) => !d.trim());
    if (emptyIdx !== -1) {
      handleUpdateDestination(emptyIdx, dest);
    } else {
      if (destinations.length >= MAX_STOPS) {
        Alert.alert('Limit reached', `You can add up to ${MAX_STOPS} stops.`);
        return;
      }
      setDestinations([...destinations, dest]);
    }
  };

  // Passenger data resolver
  const getPassengerInfo = () => {
    if (isCustomPassenger || !selectedGuest) {
      return { name: customGuestName.trim(), phone: customGuestPhone.trim() };
    }
    return { name: selectedGuest.name, phone: selectedGuest.phone };
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
    const pickupAt = atTime(pickupDate, selectedTime);
    if (!isFuture(pickupAt)) return 'Pickup date and time is in the past. Please choose a later time.';
    return null;
  };

  // Validates, warns on a likely duplicate, and takes the submit lock; false = do not submit
  const beginSubmit = async (): Promise<boolean> => {
    if (submittingRef.current) return false;
    const error = validateRequest();
    if (error) {
      Alert.alert('Check trip details', error);
      return false;
    }
    submittingRef.current = true;
    const digits = getPassengerInfo().phone.replace(/[^0-9]/g, '').slice(-10);
    const day = pickupDate;
    const duplicate = trips.some(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'CANCELLED' &&
        t.status !== 'EXPIRED' &&
        t.phone.replace(/[^0-9]/g, '').slice(-10) === digits &&
        new Date(t.date).toDateString() === new Date(day).toDateString()
    );
    const proceed =
      !duplicate ||
      (await new Promise<boolean>((resolve) =>
        Alert.alert(
          'Possible duplicate',
          'An open cab trip already exists for this guest on this date. Book another one anyway?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Book anyway', onPress: () => resolve(true) },
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

  const formattedDestinations = () => destinations.filter((d) => d.trim()).map((addr, order) => ({ address: addr, order }));

  // Send to StayRide drivers/admin (platform dispatch); quotes arrive from the server
  const handleBroadcastToAll = async () => {
    if (!(await beginSubmit())) return;
    const passenger = getPassengerInfo();
    try {
      const trip = await createTrip({
        guestName: passenger.name,
        phone: passenger.phone,
        pickup,
        ...pinFields,
        destination: cleanDestinationSummary(),
        destinations: formattedDestinations(),
        date: pickupDate,
        time: selectedTime,
        passengers,
        vehicleType,
        source: 'NEARBY_BROADCAST',
        dispatchMode: 'PLATFORM',
      });
      setLastCreatedTrip(trip);
      setBroadcastSuccessModalVisible(true);
    } catch (err: any) {
      Alert.alert('Not sent', err?.message || 'Could not send the request. Please try again.');
    } finally {
      endSubmit();
    }
  };

  // Direct assign to the owner's own driver
  const fareNum = Math.round(Number(ownFare));
  const ownFee = fareNum > 0 ? ownFleetFeeFor(config, fareNum) : 0;

  const handleDirectAssignMyDriver = async (driver: Driver | null) => {
    if (!driver) {
      Alert.alert('Choose a driver', 'Pick one of your drivers first.');
      return;
    }
    if (!(fareNum > 0)) {
      Alert.alert('Enter the fare', 'Type the fare you agreed with your driver. StayRide takes its fee from it as the guest advance.');
      return;
    }
    if (!(await beginSubmit())) return;
    const passenger = getPassengerInfo();
    try {
      const trip = await bookDriver({
        guestName: passenger.name,
        phone: passenger.phone,
        pickup,
        ...pinFields,
        destination: cleanDestinationSummary(),
        destinations: formattedDestinations(),
        date: pickupDate,
        time: selectedTime,
        passengers: Math.min(passengers, seatsFor(driver.vehicleType)),
        vehicleType: driver.vehicleType || vehicleType,
        driverId: driver.id,
        fare: fareNum,
      });
      setSelectedDriver(driver);
      setLastCreatedTrip(trip);
      setBookedSuccessModalVisible(true);
    } catch (err: any) {
      Alert.alert('Not assigned', err?.message || 'Could not assign your driver.');
    } finally {
      endSubmit();
    }
  };

  const pickupIsCustom = Boolean(customPickup.trim());
  const usedPresets = new Set(destinations.map((d) => d.trim()));
  const nearby = bookingMode === 'NEARBY';

  const tab = (mode: 'NEARBY' | 'MY_DRIVERS', icon: IconName, label: string) => {
    const active = bookingMode === mode;
    return (
      <TouchableOpacity
        style={[styles.tab, active && styles.tabActive]}
        onPress={() => setBookingMode(mode)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
      >
        <Ionicons name={icon} size={16} color={active ? Colors.white : Colors.textSecondary} />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Book a cab" onBack={() => navigation.goBack()} />

      <View style={styles.tabs}>
        {tab('NEARBY', 'navigate', 'StayRide drivers')}
        {tab('MY_DRIVERS', 'people', `My fleet · ${drivers.length}`)}
      </View>

      <FormScroll contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Ionicons name={nearby ? 'chatbubbles-outline' : 'flash-outline'} size={16} color={Colors.brandPrimaryDark} />
          <Text style={styles.introText}>
            {nearby
              ? 'Nearby drivers with the right seats quote a fare. Quotes appear in Cabs for you to accept or counter.'
              : 'Assign one of your own drivers straight away at the fare you agreed. No quotes needed.'}
          </Text>
        </View>

        {/* Route */}
        <Section
          icon="map"
          title="Route"
          right={
            <TouchableOpacity style={styles.addStop} onPress={handleAddDestination} accessibilityRole="button" accessibilityLabel="Add a stop">
              <Ionicons name="add" size={14} color={Colors.brandPrimaryDark} />
              <Text style={styles.addStopText}>Stop</Text>
            </TouchableOpacity>
          }
        >
          {/* Pickup */}
          <View style={styles.routeRow}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: Colors.statusGreen }]} />
              <View style={styles.railLine} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              {editPickup || pickupIsCustom ? (
                <TextInput
                  style={styles.input}
                  placeholder={homestayPickup}
                  value={customPickup}
                  autoFocus={editPickup && !pickupIsCustom}
                  onChangeText={(t) => {
                    setCustomPickup(t);
                    if (!t.trim()) setPickupPin(null);
                  }}
                  onBlur={() => !customPickup.trim() && setEditPickup(false)}
                  placeholderTextColor={Colors.textTertiary}
                />
              ) : (
                <TouchableOpacity onPress={() => setEditPickup(true)} accessibilityRole="button" accessibilityLabel="Change pickup">
                  <Text style={styles.routeValue} numberOfLines={2}>
                    {homestayPickup}
                  </Text>
                  <Text style={styles.routeHint}>Your homestay · tap to change</Text>
                </TouchableOpacity>
              )}
              {pickupIsCustom ? (
                <View style={styles.pickupActions}>
                  <Text style={styles.routeHint}>{pickupPin ? 'Pinned on map · the driver gets directions' : 'Pin it so the driver can navigate'}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCustomPickup('');
                      setPickupPin(null);
                      setEditPickup(false);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.linkText}>Use homestay</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setPickupMapVisible(true)} accessibilityRole="button" accessibilityLabel="Pick pickup on map">
              <Ionicons name="map-outline" size={18} color={Colors.brandPrimaryDark} />
            </TouchableOpacity>
          </View>

          {/* Drops and stops */}
          {destinations.map((dest, idx) => {
            const last = idx === destinations.length - 1;
            return (
              <View key={idx} style={styles.routeRow}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: last ? Colors.statusRed : Colors.brandPrimary }]} />
                  {!last && <View style={styles.railLine} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>{idx === 0 ? (destinations.length > 1 ? 'First stop' : 'Drop') : last ? 'Final drop' : `Stop ${idx + 1}`}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={idx === 0 ? 'Where to? Type or pick a place below' : 'Next place'}
                    value={dest}
                    onChangeText={(text) => handleUpdateDestination(idx, text)}
                    placeholderTextColor={Colors.textTertiary}
                    accessibilityLabel={idx === 0 ? 'Drop location' : `Stop ${idx + 1}`}
                  />
                </View>
                {destinations.length > 1 || dest ? (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleRemoveDestination(idx)} accessibilityRole="button" accessibilityLabel="Remove stop">
                    <Ionicons name="close" size={18} color={Colors.statusRed} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.iconBtnSpacer} />
                )}
              </View>
            );
          })}

          {config.sightseeingPresets.length > 0 ? (
            <>
              <Text style={styles.presetTitle}>Popular places</Text>
              <View style={styles.presetWrap}>
                {config.sightseeingPresets.map((dest) => {
                  const used = usedPresets.has(dest);
                  return (
                    <TouchableOpacity
                      key={dest}
                      style={[styles.preset, used && styles.presetUsed]}
                      onPress={() => handleQuickAddPreset(dest)}
                      disabled={used}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${dest}`}
                    >
                      <Ionicons name={used ? 'checkmark' : 'add'} size={12} color={used ? Colors.white : Colors.brandPrimaryDark} />
                      <Text style={[styles.presetText, used && { color: Colors.white }]}>{dest}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
        </Section>

        {/* When */}
        <Section icon="calendar" title="When">
          <Text style={styles.fieldLabel}>Pickup date</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setDatePickerVisible(true)} accessibilityRole="button" accessibilityLabel="Choose pickup date">
            <Ionicons name="calendar-outline" size={18} color={Colors.brandPrimaryDark} />
            <Text style={styles.selectText}>{fmtDay(pickupDate)}</Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <PlatformSelect label="Pickup time" value={selectedTime} options={timeOptions} onSelect={setSelectedTime} />
        </Section>

        {/* Guest */}
        <Section icon="person" title="Guest">
          {guests.length > 0 ? (
            <PlatformSelect
              label="Who is travelling"
              value={isCustomPassenger ? MANUAL : selectedGuest ? String(selectedGuest.id) : ''}
              placeholder="Choose a guest"
              options={guestOptions}
              onSelect={(v) => {
                if (v === MANUAL) return setIsCustomPassenger(true);
                setIsCustomPassenger(false);
                setSelectedGuest(guests.find((g) => String(g.id) === v) || null);
              }}
            />
          ) : null}
          {isCustomPassenger || guests.length === 0 ? (
            <View style={styles.inlineFields}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Guest name"
                value={customGuestName}
                onChangeText={setCustomGuestName}
                placeholderTextColor={Colors.textTertiary}
                accessibilityLabel="Guest name"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="WhatsApp number"
                value={customGuestPhone}
                onChangeText={setCustomGuestPhone}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textTertiary}
                accessibilityLabel="Guest WhatsApp number"
              />
            </View>
          ) : null}
          <PlatformSelect
            label="Passengers"
            value={String(Math.min(passengers, maxSeats))}
            options={passengerOptions}
            onSelect={(v) => setPassengers(Number(v))}
          />
        </Section>

        {nearby ? (
          <Section icon="car" title="Vehicle">
            <PlatformSelect
              label="Seats needed"
              value={vehicleType}
              options={vehicleOptions().map((v) => ({ label: v.label, value: v.value, icon: 'car-outline' as const, subLabel: `Usually around ${inr(v.estFare)}` }))}
              onSelect={(v) => {
                setVehicleType(v as VehicleType);
                setPassengers((p) => Math.min(p, seatsFor(v)));
              }}
            />
            <Text style={styles.hint}>Only drivers with this many seats or more get your request.</Text>
          </Section>
        ) : (
          <>
            <Section
              icon="people"
              title="Your driver"
              right={
                <TouchableOpacity onPress={() => navigation.navigate('MyDrivers')} hitSlop={8}>
                  <Text style={styles.linkText}>Manage</Text>
                </TouchableOpacity>
              }
            >
              {drivers.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="car-outline" size={32} color={Colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No drivers in your fleet yet</Text>
                  <Text style={styles.emptyText}>Add the drivers you work with, or switch to StayRide drivers.</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('MyDrivers')} accessibilityRole="button">
                    <Text style={styles.emptyBtnText}>Add my driver</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                drivers.map((drv) => {
                  const on = fleetDriverId === drv.id;
                  return (
                    <TouchableOpacity
                      key={drv.id}
                      style={[styles.driverRow, on && styles.driverRowOn]}
                      onPress={() => {
                        setFleetDriverId(drv.id);
                        setPassengers((p) => Math.min(p, seatsFor(drv.vehicleType)));
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <View style={styles.driverAvatar}>
                        <Text style={styles.driverInitial}>{(drv.name || 'D').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.driverName}>{drv.name}</Text>
                        <Text style={styles.driverMeta} numberOfLines={1}>
                          {[drv.vehicle, vehicleLabel(drv.vehicleType)].filter(Boolean).join(' · ')}
                        </Text>
                        <Text style={[styles.driverStatus, { color: drv.available ? Colors.statusGreen : Colors.statusOrange }]}>
                          {drv.available ? 'Available' : 'On a trip'}
                        </Text>
                      </View>
                      <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? Colors.brandPrimary : Colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })
              )}
            </Section>

            <Section icon="cash" title="Fare">
              <Text style={styles.fieldLabel}>Fare agreed with your driver</Text>
              <View style={styles.fareInput}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.fareText}
                  placeholder="3000"
                  value={ownFare}
                  onChangeText={(t) => setOwnFare(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textTertiary}
                  accessibilityLabel="Fare in rupees"
                />
              </View>
              {fareNum > 0 ? (
                <View style={styles.split}>
                  <View style={styles.splitRow}>
                    <Text style={styles.splitLabel}>Guest pays StayRide now (advance)</Text>
                    <Text style={styles.splitValue}>{inr(ownFee)}</Text>
                  </View>
                  <View style={styles.splitRow}>
                    <Text style={styles.splitLabel}>Guest pays your driver in cash</Text>
                    <Text style={styles.splitValue}>{inr(fareNum - ownFee)}</Text>
                  </View>
                </View>
              ) : null}
              <Text style={styles.hint}>
                StayRide fee: {config.ownFleetFeePercent}% of the fare (min {inr(config.ownFleetMinFee)}), paid by the guest as the advance.
              </Text>
            </Section>
          </>
        )}
      </FormScroll>

      {/* Sticky action */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {nearby ? (
          platformLocked ? (
            <FeatureLocked feature="platformDispatch" title="Send to StayRide drivers" />
          ) : (
            <TouchableOpacity style={[styles.cta, submitting && { opacity: 0.6 }]} onPress={handleBroadcastToAll} disabled={submitting} accessibilityRole="button">
              <Ionicons name="paper-plane" size={18} color={Colors.white} />
              <Text style={styles.ctaText}>{submitting ? 'Sending…' : 'Get quotes from drivers'}</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={[styles.cta, (submitting || drivers.length === 0) && { opacity: 0.6 }]}
            onPress={() => handleDirectAssignMyDriver(fleetDriver)}
            disabled={submitting || drivers.length === 0}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
            <Text style={styles.ctaText}>
              {submitting ? 'Assigning…' : fleetDriver ? `Assign ${fleetDriver.name.split(' ')[0]}${fareNum > 0 ? ` · ${inr(fareNum)}` : ''}` : 'Choose a driver'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <LocationPicker
        visible={pickupMapVisible}
        title="Pickup point"
        initial={pickupPin || (homestay.latitude && homestay.longitude ? { latitude: homestay.latitude, longitude: homestay.longitude } : null)}
        onConfirm={(loc) => {
          setPickupPin({ latitude: loc.latitude, longitude: loc.longitude });
          setCustomPickup(loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
          setPickupMapVisible(false);
        }}
        onClose={() => setPickupMapVisible(false)}
      />

      {/* Pickup date: a calendar limited to the admin's booking window */}
      <Modal visible={datePickerVisible} transparent animationType="fade" onRequestClose={() => setDatePickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDatePickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pickup date</Text>
            <RangeCalendar
              mode="single"
              checkIn={pickupDate}
              checkOut={pickupDate}
              maxDate={horizonEnd}
              onChange={(day) => {
                setPickupDate(day);
                setDatePickerVisible(false);
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Request sent */}
      <Modal visible={broadcastSuccessModalVisible} transparent animationType="fade" onRequestClose={() => setBroadcastSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.successIcon, { backgroundColor: Colors.statusBlueBg }]}>
              <Ionicons name="paper-plane" size={30} color={Colors.statusBlue} />
            </View>
            <Text style={styles.modalTitle}>Request sent</Text>
            <Text style={styles.modalText}>
              {lastCreatedTrip?.ref ? `Trip ${lastCreatedTrip.ref}. ` : ''}Driver quotes will appear under <Text style={{ fontWeight: '700' }}>Cabs ➔ Requested</Text>.
            </Text>
            <TouchableOpacity
              style={[styles.cta, { alignSelf: 'stretch' }]}
              onPress={() => {
                setBroadcastSuccessModalVisible(false);
                navigation.navigate('Cabs');
              }}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>View in Cabs</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Own driver assigned */}
      <Modal visible={bookedSuccessModalVisible} transparent animationType="fade" onRequestClose={() => setBookedSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.successIcon, { backgroundColor: Colors.statusGreenBg }]}>
              <Ionicons name="checkmark-circle" size={34} color={Colors.statusGreen} />
            </View>
            <Text style={[styles.modalTitle, { color: Colors.statusGreen }]}>Driver assigned</Text>
            <Text style={styles.modalText}>
              <Text style={{ fontWeight: '700' }}>{selectedDriver?.name}</Text> will drive {getPassengerInfo().name}.{'\n'}
              {cleanDestinationSummary()}
              {'\n'}
              {fmtDay(pickupDate)} at {selectedTime}
              {'\n\n'}
              {lastCreatedTrip?.status === 'CONFIRMED'
                ? 'StayRide sent the trip details to your driver and the guest on WhatsApp.'
                : `StayRide sent the guest a WhatsApp link to pay the ${inr(lastCreatedTrip?.advanceAmount ?? ownFee)} advance. Phone numbers are shared with your driver and the guest once it is paid.`}
            </Text>
            <TouchableOpacity
              style={[styles.cta, { alignSelf: 'stretch' }]}
              onPress={() => {
                setBookedSuccessModalVisible(false);
                navigation.navigate('Cabs');
              }}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  tabs: { flexDirection: 'row', backgroundColor: Colors.bgCard, padding: 4, marginHorizontal: 16, marginTop: 10, borderRadius: Radii.button, ...Shadows.card },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 11 },
  tabActive: { backgroundColor: Colors.brandPrimary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },
  intro: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.brandPrimaryLight, borderRadius: 12, padding: 12 },
  introText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radii.card, padding: 16, ...Shadows.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  addStop: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.brandPrimaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.pill },
  addStopText: { fontSize: 12, fontWeight: '800', color: Colors.brandPrimaryDark },
  routeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rail: { width: 14, alignItems: 'center', paddingTop: 22, alignSelf: 'stretch' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.white },
  railLine: { flex: 1, width: 2, backgroundColor: Colors.divider, marginTop: 4, minHeight: 20 },
  routeLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4, marginBottom: 4 },
  routeValue: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  routeHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  pickupActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  linkText: { fontSize: 13, fontWeight: '700', color: Colors.brandPrimaryDark },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgPage, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  iconBtnSpacer: { width: 40 },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.divider, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: Colors.textPrimary, marginBottom: 10 },
  presetTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginTop: 4, marginBottom: 8 },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.divider, paddingHorizontal: 11, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: Colors.white },
  presetUsed: { backgroundColor: Colors.brandPrimary, borderColor: Colors.brandPrimary },
  presetText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.divider, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 12 },
  selectText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  inlineFields: { flexDirection: 'row', gap: 8, marginTop: 4 },
  hint: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  emptyBtn: { marginTop: 12, backgroundColor: Colors.brandPrimary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radii.button },
  emptyBtnText: { color: Colors.white, fontWeight: '700' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.divider, marginBottom: 8 },
  driverRowOn: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimaryLight },
  driverAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  driverInitial: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  driverName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  driverMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  driverStatus: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  fareInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.divider, borderRadius: 12, paddingHorizontal: 12 },
  rupee: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginRight: 6 },
  fareText: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.textPrimary, paddingVertical: 12 },
  split: { backgroundColor: Colors.bgPage, borderRadius: 12, padding: 12, marginTop: 10, gap: 6 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  splitLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  splitValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.divider },
  cta: { flexDirection: 'row', gap: 8, backgroundColor: Colors.brandPrimary, paddingVertical: 15, borderRadius: Radii.button, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: Colors.bgCard, borderRadius: Radii.dialog, padding: 20, alignItems: 'center' },
  successIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  modalText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
});
