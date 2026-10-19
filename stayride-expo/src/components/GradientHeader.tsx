import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii } from '../theme/colors';

interface GradientHeaderProps {
  greeting: string;
  homestayName: string;
  tagline: string;
  location: string;
  ratingText: string;
  badgeText?: string;
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  greeting,
  homestayName,
  tagline,
  location,
  ratingText,
  badgeText = 'GOLD HOST',
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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      </View>

      <Text style={styles.title}>{homestayName}</Text>
      <Text style={styles.tagline}>{tagline}</Text>

      <View style={styles.bottomRow}>
        {!!location && (
        <View style={styles.locationContainer}>
          <Ionicons name="location-sharp" size={15} color={Colors.white} />
          <Text style={styles.locationText} numberOfLines={1}>
            {location}
          </Text>
        </View>
        )}
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color={Colors.brandAccent} />
          <Text style={styles.ratingText}>{ratingText}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: 18,
    marginVertical: 4,
    shadowColor: Colors.brandPrimaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#E6FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: Colors.brandAccent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  badgeText: {
    color: Colors.brandPrimaryDark,
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 6,
  },
  tagline: {
    color: '#D9FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    color: Colors.white,
    fontSize: 13,
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});
