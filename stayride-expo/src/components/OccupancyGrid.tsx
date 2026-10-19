import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking, Room } from '../types';
import { Colors } from '../theme/colors';
import { heldUntil } from '../utils/rooms';

const DAYS = 14;
const CELL_W = 46;
const CELL_H = 42;
const LABEL_W = 64;

interface Props {
  rooms: Room[];
  bookings: Booking[];
  onOpenBooking: (b: Booking) => void;
  onNewBooking: (room: Room, day: number) => void;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const addDays = (ms: number, n: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
};

// Rooms down the side, days across: who is in which room on which night, at a glance.
export const OccupancyGrid: React.FC<Props> = ({ rooms, bookings, onOpenBooking, onNewBooking }) => {
  const [from, setFrom] = useState(() => startOfDay(new Date().getTime()));
  const today = startOfDay(new Date().getTime());
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));

  // The booking holding this room on this night (same hold rule as booking checks)
  const holder = (room: Room, day: number) =>
    bookings.find((b) => b.roomNumber === room.number && b.status !== 'CANCELLED' && b.checkIn <= day && day < heldUntil(b));

  const colorOf = (b: Booking) =>
    b.external?.conflict ? Colors.statusRed : b.status === 'CHECKED_IN' ? Colors.brandPrimaryDark : b.external ? Colors.statusBlue : Colors.brandPrimary;

  const occupiedTonight = rooms.filter((r) => holder(r, today)).length;

  return (
    <View>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setFrom(addDays(from, -7))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={Colors.brandPrimaryDark} />
        </TouchableOpacity>
        <Text style={styles.rangeText}>
          {new Date(days[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
          {new Date(days[DAYS - 1]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => setFrom(addDays(from, 7))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={Colors.brandPrimaryDark} />
        </TouchableOpacity>
        {from !== today && (
          <TouchableOpacity style={styles.todayBtn} onPress={() => setFrom(today)}>
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.summary}>
        Tonight: {occupiedTonight} of {rooms.length} rooms taken
      </Text>

      <View style={styles.legend}>
        {[
          ['In-house', Colors.brandPrimaryDark],
          ['Booked', Colors.brandPrimary],
          ['Airbnb / OTA', Colors.statusBlue],
          ['Double booking', Colors.statusRed],
          ['Maintenance', '#CBD5E1'],
        ].map(([label, color]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Room labels stay put while the days scroll sideways */}
        <View style={{ width: LABEL_W }}>
          <View style={[styles.headCell, { width: LABEL_W }]} />
          {rooms.map((r) => (
            <View key={r.id} style={[styles.labelCell, { width: LABEL_W }]}>
              <Text style={styles.labelText} numberOfLines={1}>
                {r.number}
              </Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row' }}>
              {days.map((d) => {
                const date = new Date(d);
                return (
                  <View key={d} style={[styles.headCell, d === today && styles.headToday]}>
                    <Text style={[styles.headDow, d === today && styles.headTodayText]}>
                      {date.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)}
                    </Text>
                    <Text style={[styles.headDay, d === today && styles.headTodayText]}>{date.getDate()}</Text>
                  </View>
                );
              })}
            </View>
            {rooms.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row' }}>
                {days.map((d) => {
                  const b = holder(r, d);
                  if (b) {
                    const starts = b.checkIn === d || d === days[0];
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.cell, { backgroundColor: colorOf(b) }]}
                        onPress={() => onOpenBooking(b)}
                        activeOpacity={0.8}
                      >
                        {starts && (
                          <Text style={styles.cellText} numberOfLines={1}>
                            {b.guestName.split(' ')[0]}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }
                  if (r.status === 'MAINTENANCE') return <View key={d} style={[styles.cell, styles.cellBlocked]} />;
                  const past = d < today;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.cell, styles.cellFree, past && styles.cellPast]}
                      disabled={past}
                      onPress={() => onNewBooking(r, d)}
                      activeOpacity={0.6}
                    >
                      {!past && <Ionicons name="add" size={14} color={Colors.divider} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <Text style={styles.hint}>Tap a booking to open it, or a free night to book that room.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  navBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  rangeText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  todayBtn: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.brandPrimaryLight },
  todayText: { fontSize: 12, fontWeight: '700', color: Colors.brandPrimaryDark },
  summary: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
  headCell: { width: CELL_W, height: 40, alignItems: 'center', justifyContent: 'center' },
  headToday: { backgroundColor: Colors.brandPrimaryLight, borderRadius: 8 },
  headDow: { fontSize: 10, color: Colors.textTertiary, fontWeight: '700' },
  headDay: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  headTodayText: { color: Colors.brandPrimaryDark },
  labelCell: { height: CELL_H, justifyContent: 'center', paddingRight: 6, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  labelText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cellFree: { backgroundColor: '#F8FAFC', borderColor: Colors.divider },
  cellPast: { backgroundColor: '#F1F5F9' },
  cellBlocked: { backgroundColor: '#CBD5E1' },
  cellText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  hint: { marginTop: 10, fontSize: 11, color: Colors.textTertiary },
});
