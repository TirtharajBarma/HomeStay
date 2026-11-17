import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Room } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Pill } from './Pill';
import { photoUrl } from '../services/photoUploader';

interface RoomItemProps {
  room: Room;
  onPress: () => void;
}

export const RoomItem: React.FC<RoomItemProps> = ({ room, onPress }) => {
  const displayPhoto = room.photo || (room.photos && room.photos.length > 0 ? room.photos[0] : null);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* 1. Prominent Room Photo or Mountain Default Placeholder */}
      <View style={styles.imageContainer}>
        {displayPhoto ? (
          <Image
            source={{ uri: photoUrl(displayPhoto, 600) }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.placeholderIconCircle}>
              <Ionicons name="bed-outline" size={24} color="#C084FC" />
            </View>
            <Text style={styles.placeholderText}>StayCabs Mountain Room</Text>
            <View style={styles.mountainDeco}>
              <Ionicons name="trail-sign-outline" size={12} color="#A855F7" />
              <Text style={styles.mountainDecoText}>Add photo in room settings</Text>
            </View>
          </View>
        )}

        {/* Floating Room Status Pill */}
        <View style={styles.floatingStatus}>
          <Pill label={room.status} />
        </View>

        {/* Floating Dorm Badge */}
        {room.roomType === 'DORM' && (
          <View style={styles.floatingDormBadge}>
            <Ionicons name="people" size={11} color="#0369A1" />
            <Text style={styles.floatingDormText}>
              Dorm ({room.bedCount || 4} beds)
            </Text>
          </View>
        )}
      </View>

      {/* 2. Room Information Body */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.number}>Room {room.number}</Text>
          <Text style={styles.price}>
            ₹{room.price.toLocaleString()} {room.roomType === 'DORM' ? '/ bed' : '/ night'}
          </Text>
        </View>

        <Text style={styles.meta}>
          {room.type ? `${room.type} · ${room.floor}` : room.floor}
        </Text>

        {room.nextArrival ? (
          <View style={styles.arrivalRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.brandPrimary} />
            <Text style={styles.arrivalText}>
              Next arrival {new Date(room.nextArrival).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        ) : null}

        {room.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {room.note}
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          <Text style={styles.tapHint}>Tap to view details or edit</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.card,
  },
  imageContainer: {
    width: '100%',
    height: 135,
    backgroundColor: '#1E1435',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  placeholderIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E9D5FF',
    letterSpacing: 0.3,
  },
  mountainDeco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  mountainDecoText: {
    fontSize: 10,
    color: '#C084FC',
  },
  floatingStatus: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  floatingDormBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(224, 242, 254, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  floatingDormText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  body: {
    padding: 12,
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
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  arrivalText: {
    fontSize: 12,
    color: Colors.brandPrimaryDark,
    fontWeight: '500',
  },
  note: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  tapHint: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
