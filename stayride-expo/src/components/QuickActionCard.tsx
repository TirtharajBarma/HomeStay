import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';

interface QuickActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ icon, label, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.content}>
        <Ionicons name={icon} size={22} color={Colors.brandPrimary} />
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.brandPrimaryLight,
    borderRadius: Radii.card,
    padding: 12,
    margin: 4,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
    textAlign: 'center',
    marginTop: 6,
  },
});
