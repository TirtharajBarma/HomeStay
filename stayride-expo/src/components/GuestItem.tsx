import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Guest } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Pill } from './Pill';

interface GuestItemProps {
  guest: Guest;
  onPress: () => void;
}

export const GuestItem: React.FC<GuestItemProps> = ({ guest, onPress }) => {
  const isRepeat = guest.visits > 1;
  const lastVisitFormatted = new Date(guest.lastVisit).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {guest.name}
          </Text>
          <Pill label={isRepeat ? 'REPEAT' : 'NEW'} />
        </View>

        <Text style={styles.phone}>{guest.phone}</Text>

        <Text style={styles.meta}>
          {guest.visits} {guest.visits === 1 ? 'visit' : 'visits'} • ₹{guest.totalSpending.toLocaleString()} spent • Last: {lastVisitFormatted}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  content: {
    flex: 1,
    marginRight: 8,
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
  phone: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 5,
  },
});
