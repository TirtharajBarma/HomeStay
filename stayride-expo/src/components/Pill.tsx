import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radii } from '../theme/colors';

interface PillProps {
  label?: string;
  value?: string;
  type?: string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
}

export const Pill: React.FC<PillProps> = ({ label, value, color, bgColor, borderColor }) => {
  const displayLabel = label || value || '';
  let textColor = Colors.textSecondary;
  let bg = Colors.statusGreyBg;
  let border: string | undefined = undefined;

  const normalized = displayLabel.toUpperCase().trim();

  switch (normalized) {
    case 'AVAILABLE':
    case 'CHECKED_IN':
    case 'CHECKED IN':
    case 'CONFIRMED (TRIP)':
    case 'PAID':
    case 'ACTIVE':
      textColor = normalized === 'AVAILABLE' ? '#166534' : Colors.statusGreen;
      bg = normalized === 'AVAILABLE' ? '#DCFCE7' : Colors.statusGreenBg;
      border = normalized === 'AVAILABLE' ? '#86EFAC' : undefined;
      break;

    case 'OCCUPIED':
      // OCCUPIED (from bookings) — orange pill matching RESERVED
      textColor = '#92400E';
      bg = '#FEF3C7';
      border = '#FCD34D';
      break;

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
      textColor = normalized === 'RESERVED' ? '#92400E' : Colors.statusOrange;
      bg = normalized === 'RESERVED' ? '#FEF3C7' : Colors.statusOrangeBg;
      border = normalized === 'RESERVED' ? '#FCD34D' : undefined;
      break;

    case 'MAINTENANCE':
      textColor = '#991B1B';
      bg = '#FEE2E2';
      border = '#FCA5A5';
      break;

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
  if (borderColor) border = borderColor;

  return (
    <View style={[styles.container, { backgroundColor: bg }, border ? { borderWidth: 1, borderColor: border } : undefined]}>
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
