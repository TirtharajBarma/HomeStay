import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NIGHT_CHIPS = [1, 2, 3, 5, 7];
const DAY_MS = 86400000;

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const addDays = (ms: number, n: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
};
const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

interface Props {
  /** 'range' picks check-in then check-out and applies with the button; 'single' applies on tap */
  mode?: 'range' | 'single';
  checkIn: number;
  checkOut: number;
  /** earliest selectable day (epoch ms); defaults to today */
  minDate?: number;
  /** latest selectable day (epoch ms); unlimited when omitted */
  maxDate?: number;
  /** range: called by "Apply"; single: called on tap with the same date twice */
  onChange: (checkIn: number, checkOut: number) => void;
}

// ponytail: Sunday-first month grid, no swipe or year jump; add if owners book far ahead
export const RangeCalendar: React.FC<Props> = ({ mode = 'range', checkIn, checkOut, minDate, maxDate, onChange }) => {
  const [now] = useState(() => Date.now());
  const today = midnight(new Date(now));
  const min = midnight(new Date(minDate ?? now));
  const max = maxDate !== undefined ? midnight(new Date(maxDate)) : Infinity;
  const [month, setMonth] = useState(() => {
    const d = new Date(checkIn);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // `end` is null while a check-in is picked and the check-out is not
  const [start, setStart] = useState<number | null>(checkIn);
  const [end, setEnd] = useState<number | null>(mode === 'range' ? checkOut : null);

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1).getTime()),
  ];
  while (cells.length < 42) cells.push(null); // always 6 rows so the sheet never jumps between months

  const canGoBack = new Date(month.getFullYear(), month.getMonth(), 0).getTime() >= min;
  const canGoForward = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() <= max;
  const shiftMonth = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  const pick = (day: number) => {
    if (day < min || day > max) return;
    if (mode === 'single') {
      setStart(day);
      onChange(day, day);
      return;
    }
    if (start === null || end !== null || day <= start) {
      setStart(day);
      setEnd(null);
    } else {
      setEnd(day);
    }
  };

  const nights = start !== null && end !== null ? Math.round((end - start) / DAY_MS) : 0;
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const setNights = (n: number) => {
    if (start === null) return;
    const out = addDays(start, n);
    setEnd(out);
    // jump to the month that holds the check-out so the owner sees the result
    const d = new Date(out);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <View>
      <View style={styles.monthRow}>
        <TouchableOpacity
          style={[styles.navBtn, !canGoBack && styles.navBtnOff]}
          disabled={!canGoBack}
          onPress={() => shiftMonth(-1)}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color={canGoBack ? Colors.brandPrimaryDark : Colors.textTertiary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{monthLabel}</Text>
        <TouchableOpacity
          style={[styles.navBtn, !canGoForward && styles.navBtnOff]}
          disabled={!canGoForward}
          onPress={() => shiftMonth(1)}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={18} color={canGoForward ? Colors.brandPrimaryDark : Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekText}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`b${i}`} style={styles.cell} />;
          const disabled = day < min || day > max;
          const isStart = day === start;
          const isEnd = end !== null && day === end;
          const inside = start !== null && end !== null && day > start && day < end;
          const hasBand = start !== null && end !== null;
          return (
            <TouchableOpacity key={day} style={styles.cell} disabled={disabled} onPress={() => pick(day)} activeOpacity={0.7}>
              {/* the range band runs behind the circles; the ends are half-bands so it joins them */}
              {inside && <View style={[styles.band, styles.bandFull]} />}
              {hasBand && isStart && <View style={[styles.band, styles.bandRight]} />}
              {hasBand && isEnd && <View style={[styles.band, styles.bandLeft]} />}
              <View style={[styles.dayCircle, (isStart || isEnd) && styles.dayCircleOn, day === today && !isStart && !isEnd && styles.dayCircleToday]}>
                <Text style={[styles.dayText, disabled && styles.dayDisabled, (isStart || isEnd) && styles.dayOnText, inside && styles.dayInsideText]}>
                  {new Date(day).getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'range' && (
        <>
          <View style={styles.chipsRow}>
            <Text style={styles.chipsLabel}>Nights</Text>
            {NIGHT_CHIPS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, nights === n && styles.chipOn, start === null && styles.chipOff]}
                disabled={start === null}
                onPress={() => setNights(n)}
              >
                <Text style={[styles.chipText, nights === n && styles.chipTextOn]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>CHECK-IN</Text>
              <Text style={styles.summaryValue}>{start !== null ? fmt(start) : '—'}</Text>
            </View>
            <View style={styles.nightsBadge}>
              <Text style={styles.nightsNum}>{nights || '–'}</Text>
              <Text style={styles.nightsText}>{nights === 1 ? 'night' : 'nights'}</Text>
            </View>
            <View style={[styles.summaryCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.summaryLabel}>CHECK-OUT</Text>
              <Text style={styles.summaryValue}>{end !== null ? fmt(end) : 'Pick a date'}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setStart(null);
                setEnd(null);
              }}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, (start === null || end === null) && styles.applyBtnOff]}
              disabled={start === null || end === null}
              onPress={() => start !== null && end !== null && onChange(start, end)}
            >
              <Text style={styles.applyText}>Apply dates</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

// Re-exported so callers don't reimplement the same local-midnight maths
export { midnight as startOfDay, addDays };

const CELL = `${100 / 7}%` as const;
const CIRCLE = 38;
const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthText: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  navBtnOff: { backgroundColor: '#F1F5F9' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekText: { width: CELL, textAlign: 'center', fontSize: 12, color: Colors.textTertiary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: 44, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', top: 3, bottom: 3, backgroundColor: Colors.brandPrimaryLight },
  bandFull: { left: 0, right: 0 },
  bandRight: { left: '50%', right: 0 },
  bandLeft: { left: 0, right: '50%' },
  dayCircle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleOn: { backgroundColor: Colors.brandPrimary },
  dayCircleToday: { borderWidth: 1.5, borderColor: Colors.brandPrimary },
  dayText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  dayDisabled: { color: '#CBD5E1', fontWeight: '400' },
  dayOnText: { color: '#FFFFFF', fontWeight: '700' },
  dayInsideText: { color: Colors.brandPrimaryDark, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  chipsLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginRight: 2 },
  chip: { minWidth: 40, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center' },
  chipOn: { backgroundColor: Colors.brandPrimary },
  chipOff: { opacity: 0.5 },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  chipTextOn: { color: '#FFFFFF' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 11, letterSpacing: 0.6, fontWeight: '700', color: Colors.textTertiary, marginBottom: 3 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  nightsBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: Colors.brandPrimaryLight, marginHorizontal: 8 },
  nightsNum: { fontSize: 18, fontWeight: '800', color: Colors.brandPrimaryDark },
  nightsText: { fontSize: 11, fontWeight: '600', color: Colors.brandPrimaryDark },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  clearBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  clearText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  applyBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.brandPrimary, alignItems: 'center' },
  applyBtnOff: { opacity: 0.45 },
  applyText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
