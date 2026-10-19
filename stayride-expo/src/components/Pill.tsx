import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radii } from '../theme/colors';

interface PillProps {
  label?: string;
  value?: string;
  type?: string;
  color?: string;
  bgColor?: string;
}

export const Pill: React.FC<PillProps> = ({ label, value, color, bgColor }) => {
  const displayLabel = label || value || '';
  let textColor = Colors.textSecondary;
  let bg = Colors.statusGreyBg;

  const normalized = displayLabel.toUpperCase().trim();

  switch (normalized) {
    case 'AVAILABLE':
    case 'CHECKED_IN':
    case 'CHECKED IN':
    case 'CONFIRMED (TRIP)':
    case 'PAID':
    case 'ACTIVE':
      textColor = Colors.statusGreen;
      bg = Colors.statusGreenBg;
      break;

    case 'OCCUPIED':
    case 'CONFIRMED':
    case 'DRIVER_ASSIGNED':
    case 'DRIVER ASSIGNED':
    case 'TRIP_STARTED':
    case 'TRIP STARTED':
    case 'CREATED':
    case 'NEW':
      textColor = Colors.statusBlue;
      bg = Colors.statusBlueBg;
      break;

    case 'RESERVED':
    case 'NEW_REQUEST':
    case 'NEW REQUEST':
    case 'SENDING':
    case 'UNPAID':
    case 'PENDING':
      textColor = Colors.statusOrange;
      bg = Colors.statusOrangeBg;
      break;

    case 'MAINTENANCE':
    case 'CANCELLED':
    case 'CANCELED':
    case 'EXPIRED':
    case 'NEEDS NEW DRIVER':
    case 'FAILED':
      textColor = Colors.statusRed;
      bg = Colors.statusRedBg;
      break;

    case 'FINDING_DRIVER':
    case 'FINDING DRIVER':
    case 'REPEAT':
      textColor = Colors.statusPurple;
      bg = Colors.statusPurpleBg;
      break;

    case 'CHECKED_OUT':
    case 'CHECKED OUT':
    case 'COMPLETED':
    default:
      textColor = color || Colors.statusGrey;
      bg = bgColor || Colors.statusGreyBg;
      break;
  }

  if (color) textColor = color;
  if (bgColor) bg = bgColor;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: textColor }]}>{displayLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
