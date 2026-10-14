import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radii } from '../theme/colors';
import { useStayRide } from '../data/store';
import { TripItem } from '../components/TripItem';
import { Header } from '../components/Header';
import { plusDays } from '../data/seeder';

export const CabsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { trips, guests, createTrip, homestay, isDemoMode } = useStayRide();

  const [activeTab, setActiveTab] = useState<'requests' | 'trips'>('requests');

  const requestStatuses = ['NEW_REQUEST', 'FINDING_DRIVER', 'DRIVER_ASSIGNED'];
  const tripStatuses = ['CONFIRMED', 'TRIP_STARTED', 'COMPLETED', 'CANCELLED'];

  const filteredTrips = trips.filter((t) => {
    if (activeTab === 'requests') {
      return requestStatuses.includes(t.status);
    }
    return tripStatuses.includes(t.status);
  });

  const handleSimulateRequest = async () => {
    const homestayTitle = homestay.name || 'My Homestay';
    const randomGuests = guests.length ? guests : [{ name: homestay.ownerName ? `${homestay.ownerName} (Guest)` : 'Guest Rider', phone: homestay.phone || '+91 98000 00000' }];
    const g = randomGuests[Math.floor(Math.random() * randomGuests.length)];
    const routes = [
      { pickup: 'Bagdogra Airport', destination: homestayTitle },
      { pickup: 'NJP Station', destination: homestayTitle },
      { pickup: homestayTitle, destination: 'Nathula Pass Sightseeing' },
      { pickup: homestayTitle, destination: 'Darjeeling Mall' },
    ];
    const r = routes[Math.floor(Math.random() * routes.length)];
    const vehicles: ('SUV' | 'Sedan' | '7-seater' | '9-seater')[] = ['SUV', 'Sedan', '7-seater', '9-seater'];
    const v = vehicles[Math.floor(Math.random() * vehicles.length)];

    await createTrip({
      guestName: g.name,
      phone: g.phone,
      pickup: r.pickup,
      destination: r.destination,
      date: plusDays(Math.floor(Math.random() * 2)),
      time: '11:30 AM',
      passengers: 2 + Math.floor(Math.random() * 4),
      vehicleType: v,
    });

    Alert.alert('Request Simulated', `New cab request created for ${g.name}`);
  };

  return (
    <View style={styles.container}>
      <Header title="Cabs & Drivers" />
      {/* Top 3 Quick Nav Buttons */}
      <View style={styles.topBtnRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('FindDriver')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionBtnText}>Find Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('MyDrivers')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionBtnText}>My Drivers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Commission')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionBtnText}>Commission</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Toggle: Requests vs Trips */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'requests' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('requests')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'requests' && styles.toggleBtnTextActive]}>
            Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'trips' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('trips')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'trips' && styles.toggleBtnTextActive]}>
            Trips
          </Text>
        </TouchableOpacity>
      </View>

      {/* Subheader: Count + Simulate Request */}
      <View style={styles.subHeaderRow}>
        <Text style={styles.countText}>
          {filteredTrips.length} {activeTab === 'requests' ? 'requests' : 'trips'}
        </Text>
        {isDemoMode && (
          <TouchableOpacity onPress={handleSimulateRequest} activeOpacity={0.7}>
            <Text style={styles.simulateText}>Simulate guest request</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredTrips.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {activeTab === 'requests' ? 'No pending cab requests.' : 'No active or completed trips.'}
            </Text>
          </View>
        ) : (
          filteredTrips.map((t) => (
            <TripItem
              key={t.id}
              trip={t}
              onPress={() => navigation.navigate('CabRequestDetail', { tripId: t.id })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  topBtnRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    borderRadius: Radii.button,
    paddingVertical: 9,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.button,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radii.button - 2,
  },
  toggleBtnActive: {
    backgroundColor: Colors.brandPrimary,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: Colors.white,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  countText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  simulateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
