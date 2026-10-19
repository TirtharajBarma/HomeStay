import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Platform, Keyboard } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface Props {
  visible: boolean;
  title?: string;
  initial?: { latitude: number; longitude: number } | null;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

const DARJEELING = { latitude: 27.041, longitude: 88.2663 };
const DELTA = { latitudeDelta: 0.008, longitudeDelta: 0.008 };

// Maps need a Google key on Android outside Expo Go; without one the picker uses GPS + address only
// (a MapView without a key crashes Android release builds). iOS uses Apple Maps, no key needed.
const mapsAvailable =
  Platform.OS === 'ios' ||
  Constants.executionEnvironment === 'storeClient' ||
  Boolean((Constants.expoConfig?.extra as any)?.androidMapsKeySet);

// GPS and geocoding can hang for a long time in the hills (weak signal); never wait forever
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

// ~11 m grid key and a flat-earth distance in metres (fine at pin scale)
const keyOf = (p: { latitude: number; longitude: number }) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
const distM = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dy = (a.latitude - b.latitude) * 111320;
  const dx = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

const formatAddress = (a?: Location.LocationGeocodedAddress) =>
  a ? [a.name !== a.street ? a.name : null, a.street, a.district || a.subregion, a.city, a.postalCode].filter(Boolean).join(', ') : '';

/**
 * Blinkit/Zepto-style picker: the pin stays in the middle and the map moves under it. Search a place,
 * jump to "my location", or drag; the address under the pin is shown and confirmed with it.
 */
export const LocationPicker: React.FC<Props> = ({ visible, title = 'Set location', initial, onConfirm, onClose }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState(initial || DARJEELING);
  const [address, setAddress] = useState('');
  const [addressFor, setAddressFor] = useState(''); // which point `address` belongs to
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const geoSeq = useRef(0);
  const geoCache = useRef(new Map<string, string>());
  const centerKey = keyOf(center);
  const resolving = addressFor !== centerKey;

  // Address of the point under the pin: debounced, latest wins, cached per ~10 m.
  // While it loads, the previous address stays on screen (no flicker to "Finding…" or coordinates).
  useEffect(() => {
    if (!visible) return;
    const key = keyOf(center);
    const seq = ++geoSeq.current;
    const t = setTimeout(async () => {
      let text = geoCache.current.get(key);
      if (text === undefined) {
        try {
          const [first] = await withTimeout(Location.reverseGeocodeAsync(center), 6000);
          text = formatAddress(first);
          if (text) geoCache.current.set(key, text);
        } catch {
          text = '';
        }
      }
      if (seq !== geoSeq.current) return;
      if (text) setAddress(text);
      setAddressFor(key);
    }, 450);
    return () => clearTimeout(t);
  }, [center, visible]);

  // The map reports many tiny "moves" while it settles (animation, GPS refinement, float drift):
  // only a real move (> ~5 m) changes the pin, so the address is not looked up again and again
  const pinMoved = (latitude: number, longitude: number) => {
    setCenter((prev) => (distM(prev, { latitude, longitude }) < 5 ? prev : { latitude, longitude }));
  };

  const moveTo = (latitude: number, longitude: number) => {
    pinMoved(latitude, longitude);
    mapRef.current?.animateToRegion({ latitude, longitude, ...DELTA }, 400);
  };

  const locateMe = async () => {
    setLocating(true);
    setNotice('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNotice('Location permission is off. Search or move the map instead.');
        return;
      }
      // Last known position is instant; a fresh fix (which can take a while) refines it
      const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
      if (last) moveTo(last.coords.latitude, last.coords.longitude);
      try {
        const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000);
        // skip a second jump when the fresh fix is basically where the last known one was
        if (!last || distM(last.coords, pos.coords) > 30) moveTo(pos.coords.latitude, pos.coords.longitude);
      } catch {
        if (!last) setNotice('Could not get a GPS fix here. Search or move the map instead.');
      }
    } catch {
      setNotice('Could not get a GPS fix here. Search or move the map instead.');
    } finally {
      setLocating(false);
    }
  };

  // On open: start at the saved spot, else try the phone's position
  const handleShow = () => {
    if (initial) moveTo(initial.latitude, initial.longitude);
    else locateMe();
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setSearching(true);
    setNotice('');
    try {
      const [hit] = await withTimeout(Location.geocodeAsync(q), 8000);
      if (hit) moveTo(hit.latitude, hit.longitude);
      else setNotice('Place not found. Try a nearby landmark or town name.');
    } catch {
      setNotice('Search is not available right now. Move the map instead.');
    } finally {
      setSearching(false);
    }
  };

  // Confirm with the address under the pin; if it is still being looked up, wait a moment for it
  const confirm = async () => {
    let addr = resolving ? geoCache.current.get(centerKey) || '' : address;
    if (!addr) {
      setConfirming(true);
      try {
        const [first] = await withTimeout(Location.reverseGeocodeAsync(center), 4000);
        addr = formatAddress(first);
      } catch {
        // saved with coordinates only; the address can be filled in later
      }
      setConfirming(false);
    }
    onConfirm({ latitude: center.latitude, longitude: center.longitude, address: addr });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={handleShow}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close map">
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a place, e.g. Ghoom, Darjeeling"
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={Colors.brandPrimary} />}
        </View>

        <View style={styles.mapWrap}>
          {mapsAvailable ? (
            <>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={{ ...center, ...DELTA }}
                // the map can finish loading after the first jump (saved pin / GPS): re-centre once ready
                onMapReady={() => mapRef.current?.animateToRegion({ ...center, ...DELTA }, 0)}
                onRegionChangeComplete={(r: Region) => pinMoved(r.latitude, r.longitude)}
                showsUserLocation
                showsMyLocationButton={false}
                toolbarEnabled={false}
              />
              {/* fixed pin: the map moves under it */}
              <View pointerEvents="none" style={styles.pinWrap}>
                <Ionicons name="location" size={44} color={Colors.brandPrimaryDark} />
                <View style={styles.pinShadow} />
              </View>
            </>
          ) : (
            <View style={styles.noMap}>
              <Ionicons name="map-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.noMapText}>
                The map needs a Google Maps key on this Android build. Use your current location or search a place.
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.locateBtn} onPress={locateMe} disabled={locating} accessibilityRole="button" accessibilityLabel="Use my current location">
            {locating ? <ActivityIndicator size="small" color={Colors.brandPrimaryDark} /> : <Ionicons name="locate" size={22} color={Colors.brandPrimaryDark} />}
          </TouchableOpacity>
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.sheetLabel}>{mapsAvailable ? 'Pin location' : 'Location'}</Text>
          <Text style={[styles.address, resolving && address ? { opacity: 0.5 } : null]} numberOfLines={3}>
            {address || (resolving ? 'Finding address…' : `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`)}
          </Text>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <TouchableOpacity style={[styles.confirmBtn, confirming && { opacity: 0.7 }]} onPress={confirm} disabled={confirming} accessibilityRole="button">
            {confirming ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Confirm location</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary },
  mapWrap: { flex: 1, backgroundColor: '#E2E8F0' },
  pinWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 44 },
  pinShadow: { width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)', marginTop: -4 },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  noMap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  noMapText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  sheet: { paddingHorizontal: 18, paddingTop: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF' },
  sheetLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: Colors.textTertiary, textTransform: 'uppercase' },
  address: { marginTop: 4, fontSize: 15, fontWeight: '600', color: Colors.textPrimary, lineHeight: 21 },
  notice: { marginTop: 6, fontSize: 12, color: Colors.statusOrange },
  confirmBtn: { marginTop: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.brandPrimary, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
