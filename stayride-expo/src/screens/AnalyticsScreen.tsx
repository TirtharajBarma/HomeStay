import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { LineChart } from '../components/LineChart';
import { Colors, Radii, Shadows } from '../theme/colors';

type TimeRange = '7d' | '30d' | 'month' | 'all';

const SOURCE_COLORS: { [key: string]: string } = {
  Airbnb: '#FF385C',
  MakeMyTrip: '#E11D48',
  'Booking.com': '#003580',
  'Phone / WhatsApp': '#25D366',
  'Walk-in': '#8B5CF6',
  'Website link': '#3B82F6',
  'Repeat booking': '#F59E0B',
};

export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { bookings, rooms, trips, payoutSummary } = useStayRide();

  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const now = Date.now();
  const dayMs = 86400000;

  // Filter cutoff timestamp
  const cutoff = useMemo(() => {
    if (timeRange === '7d') return now - 7 * dayMs;
    if (timeRange === '30d') return now - 30 * dayMs;
    if (timeRange === 'month') {
      const d = new Date(now);
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }
    return 0; // all time
  }, [timeRange, now]);

  // Compute period bookings
  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'CANCELLED') return false;
      const t = b.checkIn || now;
      return t >= cutoff;
    });
  }, [bookings, cutoff, now]);

  // Compute period trips
  const periodTrips = useMemo(() => {
    return trips.filter((t) => {
      if (t.status === 'CANCELLED') return false;
      const tDate = t.date || now;
      return tDate >= cutoff;
    });
  }, [trips, cutoff, now]);

  // Revenue metrics
  const roomRevenue = useMemo(() => {
    return periodBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  }, [periodBookings]);

  const cabCommission = useMemo(() => {
    return periodTrips.reduce((sum, t) => sum + (t.commission || 0), 0);
  }, [periodTrips]);

  const totalEarnings = roomRevenue + cabCommission;

  // Occupancy rate calculation
  const occupancyRate = useMemo(() => {
    if (rooms.length === 0) return 0;
    const daysInPeriod = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 30;
    const totalAvailableRoomNights = rooms.length * daysInPeriod;
    const bookedNights = periodBookings.reduce((sum, b) => {
      const n = b.checkOut && b.checkIn ? Math.max(1, Math.round((b.checkOut - b.checkIn) / dayMs)) : 1;
      return sum + n;
    }, 0);
    return Math.min(100, Math.round((bookedNights / totalAvailableRoomNights) * 100));
  }, [rooms, periodBookings, timeRange, dayMs]);

  // Booking source breakdown
  const sourceBreakdown = useMemo(() => {
    const counts: { [key: string]: number } = {};
    periodBookings.forEach((b) => {
      const src = b.source || 'Walk-in';
      counts[src] = (counts[src] || 0) + 1;
    });
    const total = periodBookings.length || 1;
    return Object.entries(counts)
      .map(([source, count]) => ({
        source,
        count,
        percent: Math.round((count / total) * 100),
        color: SOURCE_COLORS[source] || Colors.brandPrimary,
      }))
      .sort((a, b) => b.count - a.count);
  }, [periodBookings]);

  // Weekly trend for LineChart
  const chartData = useMemo(() => {
    const numPoints = timeRange === '7d' ? 7 : 5;
    const labels: string[] = [];
    const values: number[] = [];

    if (timeRange === '7d') {
      for (let i = 6; i >= 0; i--) {
        const dayStart = now - i * dayMs;
        const dayEnd = dayStart + dayMs;
        const d = new Date(dayStart);
        labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));

        const daySum = periodBookings
          .filter((b) => (b.checkIn || 0) >= dayStart && (b.checkIn || 0) < dayEnd)
          .reduce((sum, b) => sum + (b.amount || 0), 0);
        values.push(daySum);
      }
    } else {
      for (let w = 4; w >= 0; w--) {
        const weekStart = now - (w + 1) * 7 * dayMs;
        const weekEnd = weekStart + 7 * dayMs;
        const d = new Date(weekStart);
        labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

        const weekSum = periodBookings
          .filter((b) => (b.checkIn || 0) >= weekStart && (b.checkIn || 0) < weekEnd)
          .reduce((sum, b) => sum + (b.amount || 0), 0);
        values.push(weekSum);
      }
    }

    return { labels, values };
  }, [timeRange, periodBookings, now, dayMs]);

  const hasData = periodBookings.length > 0 || periodTrips.length > 0;

  return (
    <View style={styles.container}>
      <Header title="Business Analytics" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Time Range Selector */}
        <View style={styles.timeFilterContainer}>
          {(
            [
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: 'month', label: 'This Month' },
              { key: 'all', label: 'All Time' },
            ] as const
          ).map((item) => {
            const active = timeRange === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setTimeRange(item.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hero Earnings Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Net Earnings</Text>
          <Text style={styles.heroAmount}>₹{totalEarnings.toLocaleString('en-IN')}</Text>
          <View style={styles.heroSplitRow}>
            <View style={styles.heroSplitCol}>
              <View style={styles.heroDotRow}>
                <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.heroSplitLabel}>Room Stays</Text>
              </View>
              <Text style={styles.heroSplitValue}>₹{roomRevenue.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroSplitCol}>
              <View style={styles.heroDotRow}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.heroSplitLabel}>Cab Commission</Text>
              </View>
              <Text style={styles.heroSplitValue}>₹{cabCommission.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Dual Segment Progress Bar */}
          {totalEarnings > 0 && (
            <View style={styles.dualBarContainer}>
              <View
                style={[
                  styles.dualBarRooms,
                  { flex: Math.max(0.05, roomRevenue / totalEarnings) },
                ]}
              />
              <View
                style={[
                  styles.dualBarCabs,
                  { flex: Math.max(0.05, cabCommission / totalEarnings) },
                ]}
              />
            </View>
          )}
        </View>

        {/* 2x2 Metric Grid */}
        <View style={styles.metricGrid}>
          <View style={styles.metricTile}>
            <View style={styles.metricTileHeader}>
              <Ionicons name="bed-outline" size={16} color={Colors.brandPrimary} />
              <Text style={styles.metricTileLabel}>Stays</Text>
            </View>
            <Text style={styles.metricTileValue}>{periodBookings.length}</Text>
            <Text style={styles.metricTileSub}>bookings recorded</Text>
          </View>

          <View style={styles.metricTile}>
            <View style={styles.metricTileHeader}>
              <Ionicons name="pie-chart-outline" size={16} color="#8B5CF6" />
              <Text style={styles.metricTileLabel}>Occupancy</Text>
            </View>
            <Text style={styles.metricTileValue}>{occupancyRate}%</Text>
            <Text style={styles.metricTileSub}>{rooms.length} active units</Text>
          </View>

          <View style={styles.metricTile}>
            <View style={styles.metricTileHeader}>
              <Ionicons name="car-outline" size={16} color="#10B981" />
              <Text style={styles.metricTileLabel}>Cab Rides</Text>
            </View>
            <Text style={styles.metricTileValue}>{periodTrips.length}</Text>
            <Text style={styles.metricTileSub}>trips fulfilled</Text>
          </View>

          <View style={styles.metricTile}>
            <View style={styles.metricTileHeader}>
              <Ionicons name="wallet-outline" size={16} color="#F59E0B" />
              <Text style={styles.metricTileLabel}>Payout Ready</Text>
            </View>
            <Text style={styles.metricTileValue}>
              ₹{payoutSummary ? payoutSummary.available.toLocaleString('en-IN') : '0'}
            </Text>
            <Text style={styles.metricTileSub}>available to withdraw</Text>
          </View>
        </View>

        {/* Revenue Trend Chart */}
        <Text style={styles.sectionHeader}>Stay Revenue Trend</Text>
        <View style={styles.card}>
          {hasData ? (
            <LineChart
              labels={chartData.labels}
              values={chartData.values}
              isCurrency={true}
              height={180}
            />
          ) : (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="stats-chart-outline" size={32} color={Colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No revenue in this period</Text>
              <Text style={styles.emptyStateSub}>
                New bookings and cab trips will automatically build your performance graphs.
              </Text>
            </View>
          )}
        </View>

        {/* Booking Channels Breakdown */}
        <Text style={styles.sectionHeader}>Booking Channels</Text>
        <View style={styles.card}>
          {sourceBreakdown.length > 0 ? (
            sourceBreakdown.map((item) => (
              <View key={item.source} style={styles.channelRow}>
                <View style={styles.channelLabelRow}>
                  <View style={[styles.channelDot, { backgroundColor: item.color }]} />
                  <Text style={styles.channelName}>{item.source}</Text>
                  <Text style={styles.channelCount}>
                    {item.count} {item.count === 1 ? 'stay' : 'stays'} ({item.percent}%)
                  </Text>
                </View>
                <View style={styles.channelBarBg}>
                  <View
                    style={[
                      styles.channelBarFill,
                      { width: `${Math.min(100, Math.max(5, item.percent))}%`, backgroundColor: item.color },
                    ]}
                  />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyChannelContainer}>
              <Ionicons name="globe-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.emptyStateSub}>
                Record bookings to see which channels (Airbnb, Walk-in, Direct) bring you the most guests.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 40,
  },
  timeFilterContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    padding: 3,
    borderRadius: Radii.button,
    marginBottom: 14,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: Colors.brandPrimary,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  heroSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  heroSplitCol: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.divider,
    marginHorizontal: 12,
  },
  heroDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroSplitLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  heroSplitValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 13,
  },
  dualBarContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    marginTop: 14,
    overflow: 'hidden',
  },
  dualBarRooms: {
    backgroundColor: '#8B5CF6',
  },
  dualBarCabs: {
    backgroundColor: '#10B981',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricTile: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  metricTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricTileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  metricTileValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  metricTileSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
    marginBottom: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  emptyStateSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  channelRow: {
    marginBottom: 12,
  },
  channelLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  channelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  channelName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  channelCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  channelBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  channelBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyChannelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
});
