import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
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

interface SuggestionItem {
  id: string;
  main: string;
  sub: string;
  latitude: number;
  longitude: number;
}

const DARJEELING = { latitude: 27.041, longitude: 88.2663 };
const DELTA = { latitudeDelta: 0.008, longitudeDelta: 0.008 };

const mapsAvailable =
  Platform.OS === 'ios' ||
  Constants.executionEnvironment === 'storeClient' ||
  Boolean((Constants.expoConfig?.extra as any)?.androidMapsKeySet);

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

const keyOf = (p: { latitude: number; longitude: number }) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
const distM = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dy = (a.latitude - b.latitude) * 111320;
  const dx = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

const formatAddress = (a?: Location.LocationGeocodedAddress) =>
  a ? [a.name !== a.street ? a.name : null, a.street, a.district || a.subregion, a.city, a.postalCode].filter(Boolean).join(', ') : '';

/**
 * Uber/Blinkit-style LocationPicker for Expo:
 * Stationary center pin, live typing autosuggestions (Photon pan-India),
 * and fast multi-source reverse geocoding.
 */
export const LocationPicker: React.FC<Props> = ({ visible, title = 'Set location', initial, onConfirm, onClose }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState(initial || DARJEELING);
  const [address, setAddress] = useState('');
  const [addressFor, setAddressFor] = useState('');
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Autosuggestions state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLockingSuggestion = useRef(false);

  const geoSeq = useRef(0);
  const geoCache = useRef(new Map<string, string>());
  const centerKey = keyOf(center);
  const resolving = addressFor !== centerKey;

  // Fast reverse geocoding with fallback
  useEffect(() => {
    if (!visible) return;
    if (isLockingSuggestion.current) {
      isLockingSuggestion.current = false;
      return;
    }

    const key = keyOf(center);
    const seq = ++geoSeq.current;
    const t = setTimeout(async () => {
      let text = geoCache.current.get(key);
      if (text === undefined) {
        try {
          const [first] = await withTimeout(Location.reverseGeocodeAsync(center), 3500);
          text = formatAddress(first);
        } catch {
          // Fallback to client BigDataCloud reverse geocode
          try {
            const res = await withTimeout(
              fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${center.latitude}&longitude=${center.longitude}&localityLanguage=en`),
              3000
            );
            if (res.ok) {
              const d = await res.json();
              text = [d.locality, d.city, d.principalSubdivision, d.countryName].filter(Boolean).join(', ');
            }
          } catch {}
        }
        if (text) geoCache.current.set(key, text);
      }
      if (seq !== geoSeq.current) return;
      if (text) setAddress(text);
      setAddressFor(key);
    }, 400);
    return () => clearTimeout(t);
  }, [center, visible]);

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
      const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
      if (last) moveTo(last.coords.latitude, last.coords.longitude);
      try {
        const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
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

  const handleShow = () => {
    if (initial) moveTo(initial.latitude, initial.longitude);
    else locateMe();
  };

  // Real-time debounced autosuggestions (Photon Pan-India)
  const fetchSuggestions = useCallback(async (text: string) => {
    const q = text.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    const items: SuggestionItem[] = [];

    // 1. Photon Pan-India lookup
    try {
      const res = await withTimeout(
        fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`),
        3500
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.features && Array.isArray(data.features)) {
          data.features.forEach((f: any, i: number) => {
            const [lon, lat] = f.geometry?.coordinates || [];
            if (typeof lat === 'number' && typeof lon === 'number') {
              const p = f.properties || {};
              const main = p.name || q;
              const sub = [p.street, p.locality, p.city, p.state, p.country || 'India'].filter(Boolean).join(', ');
              items.push({
                id: `sug-${i}-${lat.toFixed(4)}`,
                main,
                sub,
                latitude: lat,
                longitude: lon,
              });
            }
          });
        }
      }
    } catch {
      // Ignore network errors
    }

    // 2. Nominatim fallback if fewer than 3 results
    if (items.length < 3) {
      try {
        const osmRes = await withTimeout(
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=4`),
          2500
        );
        if (osmRes.ok) {
          const osmData = await osmRes.json();
          if (Array.isArray(osmData)) {
            osmData.forEach((d: any, idx: number) => {
              const lat = parseFloat(d.lat);
              const lon = parseFloat(d.lon);
              if (!isNaN(lat) && !isNaN(lon)) {
                const parts = (d.display_name || '').split(',');
                const main = parts[0]?.trim() || d.name || q;
                const sub = parts.slice(1, 4).join(',').trim() || 'India';
                items.push({
                  id: `osm-${idx}-${lat.toFixed(4)}`,
                  main,
                  sub,
                  latitude: lat,
                  longitude: lon,
                });
              }
            });
          }
        }
      } catch {}
    }

    setSuggestions(items);
    setShowSuggestions(items.length > 0);
    setLoadingSuggestions(false);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (suggestTimeout.current) clearTimeout(suggestTimeout.current);
    suggestTimeout.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 280);
  };

  const handleSelectSuggestion = (s: SuggestionItem) => {
    Keyboard.dismiss();
    setQuery(s.main);
    setAddress(s.sub ? `${s.main}, ${s.sub}` : s.main);
    setShowSuggestions(false);
    isLockingSuggestion.current = true;
    moveTo(s.latitude, s.longitude);
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSearching(true);
    setNotice('');

    try {
      // 1. Try Photon first (Pan-India)
      const res = await withTimeout(
        fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`),
        3500
      );
      if (res.ok) {
        const d = await res.json();
        const f = d?.features?.[0];
        if (f?.geometry?.coordinates) {
          const [lon, lat] = f.geometry.coordinates;
          const label = f.properties?.name || q;
          setAddress(label);
          isLockingSuggestion.current = true;
          moveTo(lat, lon);
          setSearching(false);
          return;
        }
      }

      // 2. Native Expo geocode fallback
      const [hit] = await withTimeout(Location.geocodeAsync(q), 5000);
      if (hit) moveTo(hit.latitude, hit.longitude);
      else setNotice('Place not found. Try a nearby landmark or town name.');
    } catch {
      setNotice('Search is not available right now. Move the map instead.');
    } finally {
      setSearching(false);
    }
  };

  const confirm = async () => {
    let addr = resolving ? geoCache.current.get(centerKey) || '' : address;
    if (!addr) {
      setConfirming(true);
      try {
        const [first] = await withTimeout(Location.reverseGeocodeAsync(center), 3000);
        addr = formatAddress(first);
      } catch {
        // Fallback
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

        {/* Search Row */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a place, e.g. Ghoom, Darjeeling"
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
          {(searching || loadingSuggestions) && <ActivityIndicator size="small" color={Colors.brandPrimary} />}
        </View>

        {/* Suggestions Overlay */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(s)}
                >
                  <Ionicons name="location-sharp" size={18} color={Colors.brandPrimary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sugMain} numberOfLines={1}>{s.main}</Text>
                    <Text style={styles.sugSub} numberOfLines={1}>{s.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Map Viewport Area */}
        <View style={styles.mapWrap}>
          {mapsAvailable ? (
            <>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={{ ...center, ...DELTA }}
                onMapReady={() => mapRef.current?.animateToRegion({ ...center, ...DELTA }, 0)}
                onRegionChangeComplete={(r: Region) => pinMoved(r.latitude, r.longitude)}
                showsUserLocation
                showsMyLocationButton={false}
                toolbarEnabled={false}
              />
              {/* Stationary center pin (hides when suggestions are open) */}
              <View
                pointerEvents="none"
                style={[
                  styles.pinWrap,
                  { opacity: showSuggestions && suggestions.length > 0 ? 0 : 1 },
                ]}
              >
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

        {/* Bottom Sheet */}
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
  suggestionsCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  sugMain: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  sugSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
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
