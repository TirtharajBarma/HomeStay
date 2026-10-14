import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { TripItem } from '../components/TripItem';
import { Colors } from '../theme/colors';

const DEFAULT_PICKUPS = [
  'NJP Station',
  'Bagdogra Airport',
  'Gangtok MG Marg',
  'Darjeeling',
  'Pelling',
];

const DROPS = [
  'NJP Station',
  'Bagdogra Airport',
  'Darjeeling Sightseeing',
  'Gangtok MG Marg',
  'Lachung',
  'Pelling',
];

const DATES = ['Today', 'Tomorrow', 'In 2 days', 'In 3 days', 'In 4 days'];
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
const VEHICLES = ['SUV', 'Sedan', '7-seater', '9-seater'];

export const GuestPageScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { homestay, rooms, trips, createTrip } = useStayRide();

  const homestayTitle = homestay.name || 'My Homestay';
  const pickups = [homestayTitle, ...DEFAULT_PICKUPS];

  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickup, setPickup] = useState(homestayTitle);
  const [destination, setDestination] = useState(DROPS[0]);
  const [dateLabel, setDateLabel] = useState(DATES[1]);
  const [time, setTime] = useState(TIMES[2]);
  const [vehicleType, setVehicleType] = useState(VEHICLES[0]);
  const [passengers, setPassengers] = useState('2');

  const baseFare = (type: string) => {
    switch (type) {
      case 'Sedan':
        return 2200;
      case '7-seater':
        return 3200;
      case '9-seater':
        return 4200;
      default:
        return 3000;
    }
  };

  const extra = dateLabel.startsWith('In 3')
    ? 400
    : dateLabel.startsWith('In 2')
    ? 300
    : dateLabel.startsWith('In 4')
    ? 500
    : 0;
  const estimatedFare = baseFare(vehicleType) + extra;

  const dateOffset = (label: string) => {
    if (label === 'Today') return 0;
    if (label === 'Tomorrow') return 1;
    if (label === 'In 2 days') return 2;
    if (label === 'In 3 days') return 3;
    if (label === 'In 4 days') return 4;
    return 1;
  };

  const handleRequestCab = async () => {
    const trimmedName = guestName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }
    if (!trimmedPhone) {
      Alert.alert('Required', 'Please enter your phone number');
      return;
    }

    const d = new Date();
    d.setDate(d.getDate() + dateOffset(dateLabel));

    await createTrip({
      guestName: trimmedName,
      phone: trimmedPhone,
      pickup,
      destination,
      date: d.getTime(),
      time,
      passengers: parseInt(passengers, 10) || 2,
      vehicleType: vehicleType as any,
    });

    Alert.alert(
      'Cab Request Sent!',
      `Your request for a ${vehicleType} on ${dateLabel} at ${time} has reached ${homestay.name}. You will get a call once a driver is assigned.`
    );
  };

  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE');
  const myTrips = trips.filter((t) => phone.trim() !== '' && t.phone === phone.trim());

  return (
    <View style={styles.container}>
      <Header title={homestay.name} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Homestay Public Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroName}>{homestay.name}</Text>
          <Text style={styles.heroLocation}>{homestay.location}</Text>
          <Text style={styles.heroDesc}>{homestay.description}</Text>
        </View>

        {/* Available Rooms */}
        <Text style={styles.sectionHeader}>Available Rooms</Text>
        {availableRooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No rooms available for these dates.</Text>
          </View>
        ) : (
          availableRooms.map((r) => (
            <View key={r.id} style={styles.roomRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomTitle}>
                  Room {r.number} · {r.type}
                </Text>
                <Text style={styles.roomNote}>{r.note}</Text>
              </View>
              <Text style={styles.roomPrice}>
                ₹{r.price.toLocaleString()}
                {'\n'}
                <Text style={styles.perNight}>per night</Text>
              </Text>
            </View>
          ))
        )}

        {/* Need a Cab Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Need a cab?</Text>
          <Text style={styles.formSubtitle}>
            Safe pickups and local sightseeing directly from your homestay.
          </Text>

          <Text style={styles.label}>Your Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Aditi Roy"
            placeholderTextColor={Colors.textSecondary}
            value={guestName}
            onChangeText={setGuestName}
          />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="+91 98000 00000"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Pickup</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {pickups.map((p) => {
              const active = pickup === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPickup(p)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {DROPS.map((d) => {
              const active = destination === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDestination(d)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {DATES.map((dt) => {
              const active = dateLabel === dt;
              return (
                <TouchableOpacity
                  key={dt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDateLabel(dt)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {dt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {TIMES.map((t) => {
              const active = time === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setTime(t)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Vehicle Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {VEHICLES.map((v) => {
              const active = vehicleType === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setVehicleType(v)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Passengers</Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            value={passengers}
            onChangeText={setPassengers}
          />

          <Text style={styles.fareNote}>
            Estimated fare ₹{estimatedFare.toLocaleString()} · final fare confirmed when the driver accepts
          </Text>

          <TouchableOpacity style={styles.requestBtn} onPress={handleRequestCab}>
            <Text style={styles.requestBtnText}>Request Cab</Text>
          </TouchableOpacity>
        </View>

        {/* My Trips Status */}
        {phone.trim() !== '' && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionHeader}>My Cab Requests</Text>
            {myTrips.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No requests under {phone}</Text>
              </View>
            ) : (
              myTrips.map((t) => (
                <TripItem
                  key={t.id}
                  trip={t}
                  onPress={() =>
                    Alert.alert(
                      'Trip Status',
                      `${t.pickup} → ${t.destination}\nDriver: ${t.driverName || 'Not assigned yet'}\nStatus: ${t.status}`
                    )
                  }
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  heroName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  heroLocation: {
    fontSize: 14,
    color: Colors.brandPrimaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  heroDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  roomRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  roomTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  roomNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roomPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
    textAlign: 'right',
  },
  perNight: {
    fontSize: 10,
    fontWeight: 'normal',
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  formSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: Colors.brandPrimary,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fareNote: {
    fontSize: 12,
    color: Colors.brandPrimaryDark,
    backgroundColor: Colors.brandPrimaryLight,
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
    lineHeight: 16,
  },
  requestBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  requestBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
