import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Room } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Pill } from './Pill';

interface RoomItemProps {
  room: Room;
  onPress: () => void;
}

export const RoomItem: React.FC<RoomItemProps> = ({ room, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.topRow}>
        <Text style={styles.number}>Room {room.number}</Text>
        <Pill label={room.status} />
      </View>
      <Text style={styles.meta}>
        {room.type} • {room.floor}
      </Text>
      {room.note ? <Text style={styles.note} numberOfLines={1}>{room.note}</Text> : null}
      <View style={styles.bottomRow}>
        <Text style={styles.price}>₹{room.price.toLocaleString()} / night</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
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
  number: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  note: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
});
