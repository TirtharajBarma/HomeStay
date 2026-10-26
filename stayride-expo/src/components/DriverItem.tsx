import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Driver } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Pill } from './Pill';

interface DriverItemProps {
  driver: Driver;
  onPress: () => void;
  onBook?: () => void;
  onDelete?: () => void;
  showActiveToggle?: boolean;
  onToggleActive?: (val: boolean) => void;
  onToggleAvailable?: (val: boolean) => void;
}

export const DriverItem: React.FC<DriverItemProps> = ({
  driver,
  onPress,
  onBook,
  onDelete,
  showActiveToggle,
  onToggleActive,
  onToggleAvailable,
}) => {
  const handleCallDriver = (e: any) => {
    e.stopPropagation();
    if (driver.phone) {
      const clean = driver.phone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${clean}`);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {driver.name}
        </Text>
        <View style={styles.ratingBox}>
          <Ionicons name="star" size={14} color={Colors.brandAccent} />
          <Text style={styles.rating}>{driver.rating ? driver.rating.toFixed(1) : '—'}</Text>
        </View>
        <Pill label={driver.available ? 'AVAILABLE' : 'OFF DUTY'} />
      </View>

      <Text style={styles.vehicle}>
        {driver.vehicle} • {driver.vehicleType} • {driver.seats} seats
      </Text>

      <View style={styles.areaRow}>
        <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.areaText} numberOfLines={1}>
          {driver.area}
        </Text>
      </View>

      <View style={styles.tripsRow}>
        {driver.trips.map((t, idx) => (
          <View key={idx} style={styles.tripTag}>
            <Text style={styles.tripTagText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity
          style={styles.phoneBtn}
          onPress={handleCallDriver}
          accessibilityRole="button"
          accessibilityLabel={`Call ${driver.name} at ${driver.phone}`}
        >
          <Ionicons name="call" size={14} color={Colors.brandPrimary} />
          <Text style={styles.phone}>{driver.phone}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {showActiveToggle && onToggleActive && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch
                value={driver.active}
                onValueChange={onToggleActive}
                trackColor={{ false: Colors.statusGreyBg, true: Colors.brandPrimaryLight }}
                thumbColor={driver.active ? Colors.brandPrimary : Colors.statusGrey}
              />
            </View>
          )}

          {onToggleAvailable && !showActiveToggle && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Available</Text>
              <Switch
                value={driver.available}
                onValueChange={onToggleAvailable}
                trackColor={{ false: Colors.statusGreyBg, true: Colors.brandPrimaryLight }}
                thumbColor={driver.available ? Colors.brandPrimary : Colors.statusGrey}
              />
            </View>
          )}

          {onBook && (
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={(e) => {
                e.stopPropagation();
                onBook();
              }}
            >
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.statusRed} />
            </TouchableOpacity>
          )}
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  rating: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginLeft: 3,
  },
  vehicle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  areaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  tripsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tripTag: {
    backgroundColor: Colors.bgPage,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: Colors.divider,
  },
  tripTagText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: 10,
    paddingTop: 8,
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: Colors.brandPrimaryLight,
    borderRadius: 8,
  },
  phone: {
    fontSize: 13,
    color: Colors.brandPrimaryDark,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  bookBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
