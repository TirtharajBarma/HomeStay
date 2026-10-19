import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii } from '../theme/colors';
import { useStayRide } from '../data/store';
import { GuestItem } from '../components/GuestItem';
import { PlatformSelect } from '../components/PlatformSelect';
import { Header } from '../components/Header';
import { FeatureLocked } from '../components/FeatureLocked';
import { Guest } from '../types';
import { askGuestForCab as askForCab } from '../utils/askCab';

const PERIOD_OPTIONS = [
  { label: 'All time', value: '0', icon: 'calendar-outline' as const },
  { label: 'Last 7 days', value: '7', icon: 'time-outline' as const },
  { label: 'Last 30 days', value: '30', icon: 'time-outline' as const },
  { label: 'Last 6 months', value: '180', icon: 'calendar-outline' as const },
  { label: 'Last 1 year', value: '365', icon: 'calendar-outline' as const },
];

export const GuestsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { guests, bookings, searchGuests, countGuests, askGuestForCab, deleteGuest, features } =
    useStayRide();
  const linksLocked = features?.guestCabLinks === false;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'NEW' | 'REPEAT'>('ALL');
  const [periodDays, setPeriodDays] = useState(0);

  const filteredGuests = searchGuests(query, filter, periodDays);

  const handleDeleteGuest = (g: Guest) => {
    Alert.alert(
      'Delete Guest Record',
      `Are you sure you want to remove ${g.name} from your homestay database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // deleteGuest reports instead of throwing; the server refuses guests with an active booking
            const outcome = await deleteGuest(g.id);
            if (!outcome.ok) Alert.alert('Could not delete guest', outcome.error || 'Please try again.');
          },
        },
      ]
    );
  };

  // Ask-for-cab is only offered to guests currently checked in
  const isCheckedIn = (g: Guest) =>
    bookings.some((b) => b.status === 'CHECKED_IN' && (b.guestId === g.id || b.phone === g.phone));

  // StayRide's server sends the link from the company WhatsApp number
  const handleAskCab = (guest: Guest) => askForCab(askGuestForCab, guest);

  return (
    <View style={styles.container}>
      <Header title="Guest Database" />
      {/* Search Input Box */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search guest by name, phone or email..."
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={Colors.textSecondary}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Row: Chips + PlatformSelect Period Dropdown */}
      <View style={styles.filterRow}>
        <View style={styles.chipsRow}>
          {(['ALL', 'NEW', 'REPEAT'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'ALL' ? 'All' : f === 'NEW' ? 'New' : 'Repeat'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ width: 140 }}>
          <PlatformSelect
            value={String(periodDays)}
            options={PERIOD_OPTIONS}
            onSelect={(v) => setPeriodDays(Number(v))}
          />
        </View>
      </View>

      {/* Subheader counts */}
      <Text style={styles.countText}>
        {filteredGuests.length} showing • {guests.length} guests • {countGuests(true)} repeat • {countGuests(false)} new
      </Text>

      {/* Guest List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {linksLocked && guests.some(isCheckedIn) && <FeatureLocked feature="guestCabLinks" title="Ask-for-Cab guest links" />}
        {filteredGuests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No guests found matching your filter.</Text>
          </View>
        ) : (
          filteredGuests.map((g) => (
            <GuestItem
              key={g.id}
              guest={g}
              onPress={() => navigation.navigate('GuestDetail', { guestId: g.id })}
              onLongPress={() => handleDeleteGuest(g)}
              onAskCab={isCheckedIn(g) && !linksLocked ? handleAskCab : undefined}
            />
          ))
        )}
      </ScrollView>

      {/* FAB to Add Guest */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewGuest')}
        activeOpacity={0.8}
      >
        <Ionicons name="person-add" size={24} color={Colors.white} />
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    marginHorizontal: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
  },
  chipsRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.bgCard,
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.button,
    backgroundColor: Colors.brandPrimaryLight,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  countText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 80,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.brandPrimaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
});
