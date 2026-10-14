import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { RadarView } from '../components/RadarView';
import { DriverItem } from '../components/DriverItem';
import { Pill } from '../components/Pill';
import { PlatformSelect } from '../components/PlatformSelect';
import { Colors } from '../theme/colors';
import { Driver, Guest } from '../types';

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

const RAZORPAY = 'https://rzp.io/l/stayride-advance';

export const FindDriverScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { homestay, networkDrivers, guests, bookDriver } = useStayRide();

  const homestayTitle = homestay.name || 'My Homestay';
  const pickupOptions = useMemo(() => [
    { label: homestayTitle, value: homestayTitle, icon: 'home-outline' as const },
    { label: 'Current GPS location', value: 'Use my current location', icon: 'navigate-outline' as const },
    { label: 'NJP Railway Station', value: 'NJP Station', icon: 'train-outline' as const },
    { label: 'Bagdogra Airport (IXB)', value: 'Bagdogra Airport', icon: 'airplane-outline' as const },
    { label: 'Gangtok MG Marg Stand', value: 'Gangtok MG Marg', icon: 'location-outline' as const },
    { label: 'Darjeeling Mall Stand', value: 'Darjeeling', icon: 'location-outline' as const },
    { label: 'Pelling Market', value: 'Pelling', icon: 'location-outline' as const },
  ], [homestayTitle]);

  const [panel, setPanel] = useState<'INPUT' | 'SEARCHING' | 'RESULTS'>('INPUT');
  const [pickup, setPickup] = useState(homestayTitle);
  const [selectedTime, setSelectedTime] = useState(TIMES[2]);
  const [selectedDateIdx, setSelectedDateIdx] = useState(1);

  // Profile modal
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Booking Flow Modals
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [passengerModalVisible, setPassengerModalVisible] = useState(false);
  const [bookedSuccessModalVisible, setBookedSuccessModalVisible] = useState(false);

  const [bookingGuest, setBookingGuest] = useState<Guest | null>(null);

  const dates = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
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

  const handleStartSearch = () => {
    setPanel('SEARCHING');
    setTimeout(() => {
      setPanel('RESULTS');
    }, 3000);
  };

  const handleDriverPress = (driver: Driver) => {
    setSelectedDriver(driver);
    setProfileModalVisible(true);
  };

  const handleBookNowFromProfile = () => {
    setProfileModalVisible(false);
    setBookingModalVisible(true);
  };

  const handleContinueBooking = () => {
    if (guests.length === 0) {
      Alert.alert('Notice', 'Add a guest first, then book a cab');
      return;
    }
    setBookingModalVisible(false);
    setPassengerModalVisible(true);
  };

  const handleConfirmPassenger = async () => {
    if (!bookingGuest || !selectedDriver) return;
    setPassengerModalVisible(false);

    await bookDriver({
      guestName: bookingGuest.name,
      phone: bookingGuest.phone,
      pickup: pickup === 'Use my current location' ? homestay.name : pickup,
      destination: 'Local travel',
      date: dates[selectedDateIdx].ms,
      time: selectedTime,
      passengers: 2,
      vehicleType: selectedDriver.vehicleType,
      driverId: selectedDriver.id,
    });

    setBookedSuccessModalVisible(true);
  };

  const shareWhatsapp = () => {
    if (!bookingGuest || !selectedDriver) return;
    const cleanPhone = bookingGuest.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const dateText = dates[selectedDateIdx].label;
    const msg = `Dear ${bookingGuest.name}, your driver ${selectedDriver.name} has been booked from ${homestay.name} for ${dateText} at ${selectedTime} (pickup: ${pickup}). Kindly pay the advance booking charge to confirm the trip: ${RAZORPAY}`;
    const url = `whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'WhatsApp is not installed on this device');
    });
  };

  return (
    <View style={styles.container}>
      <Header title="Find a Driver" onBack={() => navigation.goBack()} />

      {panel === 'INPUT' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Book verified local drivers</Text>
            <Text style={styles.cardSubtitle}>
              Instantly connect with 50+ network drivers across Sikkim and Darjeeling.
            </Text>

            <PlatformSelect
              label="Pickup point"
              value={pickup}
              options={pickupOptions}
              onSelect={setPickup}
            />

            <Text style={styles.label}>Ride Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
              {dates.map((d, idx) => {
                const active = selectedDateIdx === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dateChip, active && styles.chipActive]}
                    onPress={() => setSelectedDateIdx(idx)}
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

            <TouchableOpacity style={styles.searchBtn} onPress={handleStartSearch}>
              <Text style={styles.searchBtnText}>Search nearby drivers</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {panel === 'SEARCHING' && (
        <View style={styles.radarContainer}>
          <RadarView size={240} />
          <Text style={styles.radarTitle}>Searching 50+ nearby drivers…</Text>
          <Text style={styles.radarSubtitle}>
            Matching vehicle types, ratings, and real-time availability near {pickup}
          </Text>
        </View>
      )}

      {panel === 'RESULTS' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultsBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsCount}>
                {networkDrivers.length} drivers near {pickup}
              </Text>
              <Text style={styles.resultsSort}>Nearest first · Verified StayRide Fleet</Text>
            </View>
            <TouchableOpacity
              style={styles.searchAgainBtn}
              onPress={() => setPanel('INPUT')}
            >
              <Text style={styles.searchAgainText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {networkDrivers.map((driver) => (
            <DriverItem
              key={driver.id}
              driver={driver}
              onPress={() => handleDriverPress(driver)}
              onBook={() => {
                setSelectedDriver(driver);
                setBookingModalVisible(true);
              }}
            />
          ))}
        </ScrollView>
      )}

      {/* Driver Profile Modal */}
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
                <Text style={styles.profileRating}>★ {selectedDriver.rating} rating</Text>
                <Text style={styles.profileVehicle}>
                  {selectedDriver.vehicle} · {selectedDriver.vehicleType} · {selectedDriver.seats} seats
                </Text>
                <Text style={styles.profileArea}>{selectedDriver.area}</Text>
                <Text style={styles.profileTrips}>
                  Routes: {selectedDriver.trips?.join(' · ') || 'Local & Outstation'}
                </Text>
                <Text style={styles.profilePhone}>{selectedDriver.phone}</Text>

                <View style={{ marginVertical: 12 }}>
                  <Pill
                    type="driver"
                    value={selectedDriver.available ? 'AVAILABLE NOW' : 'ON A TRIP'}
                  />
                </View>

                <TouchableOpacity
                  style={styles.bookNowBtn}
                  onPress={handleBookNowFromProfile}
                >
                  <Text style={styles.bookNowBtnText}>Book now</Text>
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

      {/* Booking Form Modal */}
      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setBookingModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Book {selectedDriver?.name}</Text>
            <Text style={styles.modalSubtitle}>
              Confirm pickup, date, and time for this ride.
            </Text>

            <Text style={styles.label}>Pickup</Text>
            <Text style={styles.modalVal}>{pickup}</Text>

            <Text style={styles.label}>Date</Text>
            <Text style={styles.modalVal}>{dates[selectedDateIdx]?.label}</Text>

            <Text style={styles.label}>Time</Text>
            <Text style={styles.modalVal}>{selectedTime}</Text>

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleContinueBooking}
            >
              <Text style={styles.continueBtnText}>Continue to Passenger</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Select Passenger Modal */}
      <Modal
        visible={passengerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPassengerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPassengerModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Who is this cab for?</Text>
            <Text style={styles.modalSubtitle}>Select one of your registered guests</Text>
            <ScrollView style={{ maxHeight: 260, marginVertical: 10 }}>
              {guests.map((g) => {
                const active = bookingGuest?.id === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.guestPickItem, active && styles.guestPickItemActive]}
                    onPress={() => setBookingGuest(g)}
                  >
                    <Text style={[styles.guestPickName, active && styles.guestPickNameActive]}>
                      {g.name}
                    </Text>
                    <Text style={styles.guestPickPhone}>{g.phone}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.continueBtn, !bookingGuest && { opacity: 0.5 }]}
              disabled={!bookingGuest}
              onPress={handleConfirmPassenger}
            >
              <Text style={styles.continueBtnText}>Confirm and Book</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Booking Success / WhatsApp Share Modal */}
      <Modal
        visible={bookedSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBookedSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.successTitle}>Cab Booked Successfully!</Text>
            <Text style={styles.successMessage}>
              Driver {selectedDriver?.name} is booked for {bookingGuest?.name} from {pickup} at {selectedTime} on {dates[selectedDateIdx]?.label}.
            </Text>
            <TouchableOpacity style={styles.whatsappBtn} onPress={shareWhatsapp}>
              <Text style={styles.whatsappBtnText}>Send WhatsApp Confirmation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setBookedSuccessModalVisible(false);
                navigation.goBack();
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
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 36,
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
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
  dateChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  timeChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  searchBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 22,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
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
  profilePhone: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
    marginTop: 8,
  },
  bookNowBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 10,
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  bookNowBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  modalVal: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  continueBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  guestPickItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    marginBottom: 8,
  },
  guestPickItemActive: {
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandPrimaryLight,
  },
  guestPickName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  guestPickNameActive: {
    color: Colors.brandPrimaryDark,
  },
  guestPickPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: Colors.statusGreen,
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  doneBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
});
