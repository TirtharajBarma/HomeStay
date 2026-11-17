import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';

interface GradientHeaderProps {
  greeting: string;
  homestayName: string;
  tagline: string;
  location: string;
  ratingText: string;
  hasStar?: boolean;
  badgeText?: string;
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  greeting,
  homestayName,
  tagline,
  location,
  ratingText,
  hasStar = false,
  badgeText = 'Verified Host',
}) => {
  return (
    <LinearGradient
      colors={[Colors.brandPrimary, Colors.brandPrimaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.greeting}>{greeting}</Text>
        {!!badgeText && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{homestayName}</Text>
      {!!tagline && <Text style={styles.tagline}>{tagline}</Text>}

      <View style={styles.bottomRow}>
        {!!location && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color="#DDD6FE" />
            <Text style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}
        <View style={styles.ratingContainer}>
          <Ionicons name={hasStar ? "star" : "calendar-outline"} size={13} color={hasStar ? "#F59E0B" : "#DDD6FE"} />
          <Text style={styles.ratingText}>{ratingText}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: 20,
    marginVertical: 4,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#DDD6FE',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  tagline: {
    color: '#DDD6FE',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
});
