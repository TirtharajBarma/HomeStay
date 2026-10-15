import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CabTrip } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Pill } from './Pill';
import { formatINR } from '../utils/format';

interface TripItemProps {
  trip: CabTrip;
  onPress: () => void;
}

export const TripItem: React.FC<TripItemProps> = ({ trip, onPress }) => {
  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {trip.guestName}
        </Text>
        <Pill label={trip.status.replace(/_/g, ' ')} />
      </View>

      <View style={styles.routeRow}>
        <Ionicons name="navigate-circle" size={16} color={Colors.brandPrimary} />
        <Text style={styles.routeText} numberOfLines={1}>
          {trip.pickup} → {trip.destination}
        </Text>
      </View>

      <Text style={styles.meta}>
        {formatDate(trip.date)} • {trip.time} • {trip.passengers} pax • {trip.vehicleType}
      </Text>

      <View style={styles.bottomRow}>
        <Text style={styles.fare}>
          {trip.status === 'COMPLETED' ? `Fare: ${formatINR(trip.fare)}` : `Est. ${formatINR(trip.estFare)}`}
        </Text>
        {trip.driverName ? (
          <Text style={styles.driverText} numberOfLines={1}>
            Driver: {trip.driverName}
          </Text>
        ) : (
          <Text style={styles.driverUnassigned}>Unassigned</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  routeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginLeft: 6,
    flex: 1,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  fare: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  driverText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  driverUnassigned: {
    fontSize: 12,
    color: Colors.statusOrange,
    fontWeight: '500',
  },
});
