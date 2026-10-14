import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Booking } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Pill } from './Pill';

interface BookingItemProps {
  booking: Booking;
  onPress: () => void;
}

export const BookingItem: React.FC<BookingItemProps> = ({ booking, onPress }) => {
  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {booking.guestName}
        </Text>
        <Pill label={booking.status} />
      </View>
      <Text style={styles.route}>
        Room {booking.roomNumber} • {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
      </Text>
      <Text style={styles.dates}>
        {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
      </Text>
      <View style={styles.bottomRow}>
        <Text style={styles.amount}>₹{booking.amount?.toLocaleString()}</Text>
        <Pill label={booking.paid ? 'PAID' : 'UNPAID'} />
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
  route: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  dates: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
  },
  amount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
});
