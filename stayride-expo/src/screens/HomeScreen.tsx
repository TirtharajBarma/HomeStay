import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { GradientHeader } from '../components/GradientHeader';
import { StatCard } from '../components/StatCard';
import { QuickActionCard } from '../components/QuickActionCard';
import { LineChart } from '../components/LineChart';
import { BookingItem } from '../components/BookingItem';
import { TripItem } from '../components/TripItem';
import { PlatformSelect } from '../components/PlatformSelect';
import { Header } from '../components/Header';
import { SyncBanner } from '../components/SyncBanner';

const HOME_PERIOD_OPTIONS = [
  { label: 'Last 7 days', value: '7d', icon: 'time-outline' as const },
  { label: 'Last 30 days', value: '30d', icon: 'calendar-outline' as const },
  { label: 'Last 6 months', value: '6m', icon: 'calendar-outline' as const },
  { label: 'Last 1 year', value: '1y', icon: 'calendar-outline' as const },
];

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    homestay,
    todayBookings,
    currentGuestCount,
    availableRoomCount,
    monthRevenue,
    occupancyPercent,
    commissionEarned,
    payoutSummary,
    totalBookings,
    recentBookings,
    upcomingCheckIns,
    recentTrips,
    getChartData,
    sync,
    syncing,
    isDemoMode,
  } = useStayRide();

  const [period, setPeriod] = useState<'7d' | '30d' | '6m' | '1y'>('30d');
  const [metric, setMetric] = useState<'revenue' | 'bookings' | 'cabs' | 'commission'>('revenue');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  const formatSyncAge = (date: Date): string => {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  };

  const isRecentSync = Date.now() - lastSyncedAt.getTime() < 2 * 60 * 1000;

  const handleSync = async () => {
    await sync();
    setLastSyncedAt(new Date());
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      handleSync();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const chartData = getChartData(metric, period);

  return (
    <View style={styles.container}>
      <Header title={homestay.name || 'My Homestay'} />
      <SyncBanner />
      <View style={styles.syncRow}>
        <View style={[styles.syncDot, { backgroundColor: isRecentSync ? '#16A34A' : '#94A3B8' }]} />
        <Text style={styles.syncText}>Last synced: {formatSyncAge(lastSyncedAt)}</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 12 }]}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={handleSync} colors={[Colors.brandPrimary]} />}
        showsVerticalScrollIndicator={false}
      >
        <GradientHeader
          greeting={homestay.ownerName ? `${greeting()}, ${homestay.ownerName.split(' ')[0]}` : greeting()}
          homestayName={homestay.name || 'My Homestay'}
          tagline="Cosy stays in the clouds. Mountain cabs, zero hassle."
          location={(homestay.location || '').split(',')[0]}
          ratingText={
            isDemoMode
              ? `4.9 • ${totalBookings()} stays`
              : totalBookings() === 0
              ? 'New Homestay • 0 stays'
              : `${totalBookings()} stays`
          }
          badgeText={
            isDemoMode
              ? 'GOLD HOST'
              : totalBookings() === 0
              ? 'NEW HOST'
              : 'HOST'
          }
        />

        {/* Today at a glance */}
        <Text style={styles.sectionTitle}>Today at a glance</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statRow}>
            <StatCard
              icon="calendar"
              value={todayBookings().length}
              label="Arrivals today"
              onPress={() => navigation.navigate('Rooms' as any)}
            />
            <StatCard
              icon="people"
              value={currentGuestCount()}
              label="Current guests"
              onPress={() => navigation.navigate('Guests' as any)}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              icon="bed"
              value={availableRoomCount()}
              label="Available rooms"
              onPress={() => navigation.navigate('Rooms' as any)}
            />
            <StatCard
              icon="cash"
              value={`₹${monthRevenue().toLocaleString()}`}
              label="Room revenue this month"
              onPress={() => navigation.navigate('Analytics')}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              icon="car"
              value={recentTrips(100).length}
              label="Cab bookings"
              onPress={() => navigation.navigate('Cabs' as any)}
            />
            <StatCard
              icon="pie-chart"
              value={`${occupancyPercent()}%`}
              label="Occupancy"
              onPress={() => navigation.navigate('Analytics')}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              icon="trending-up"
              value={`₹${commissionEarned().toLocaleString()}`}
              label="Cab commission earned"
              onPress={() => navigation.navigate('Commission')}
            />
            <StatCard
              icon="time"
              value={payoutSummary ? `₹${payoutSummary.available.toLocaleString()}` : '—'}
              label="Commission to withdraw"
              onPress={() => navigation.navigate('Commission')}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.quickGrid}>
          <View style={styles.quickRow}>
            <QuickActionCard
              icon="add"
              label="Add Booking"
              onPress={() => navigation.navigate('NewBooking')}
            />
            <QuickActionCard
              icon="bed"
              label="Manage Rooms"
              onPress={() => navigation.navigate('Rooms' as any)}
            />
            <QuickActionCard
              icon="search"
              label="Find Driver"
              onPress={() => navigation.navigate('FindDriver')}
            />
          </View>
          <View style={styles.quickRow}>
            <QuickActionCard
              icon="navigate"
              label="Cab Requests"
              onPress={() => navigation.navigate('Cabs' as any)}
            />
            {/* Navigates directly to FindDriver flow */}
            <QuickActionCard
              icon="car"
              label="Ask for Cab"
              onPress={() => navigation.navigate('FindDriver')}
            />
          </View>
        </View>

        {/* More actions — less prominent */}
        <TouchableOpacity
          style={styles.moreActionsRow}
          onPress={() => navigation.navigate('Campaign')}
          activeOpacity={0.7}
        >
          <Text style={styles.moreActionsText}>📣  Campaign</Text>
        </TouchableOpacity>

        {/* Performance Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.cardTitle}>Performance</Text>
            <View style={{ width: 140 }}>
              <PlatformSelect
                value={period}
                options={HOME_PERIOD_OPTIONS}
                onSelect={(v) => setPeriod(v as any)}
              />
            </View>
          </View>

          {/* Metric Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {(['revenue', 'bookings', 'cabs', 'commission'] as const).map((m) => {
              const active = metric === m;
              const labels = {
                revenue: 'Revenue',
                bookings: 'Bookings',
                cabs: 'Cab rides',
                commission: 'Commission',
              };
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setMetric(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {labels[m]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <LineChart
            labels={chartData.labels}
            values={chartData.values}
            isCurrency={metric === 'revenue' || metric === 'commission'}
          />

          {/* Performance KPI Row (matching Android) */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>Total</Text>
              <Text style={styles.kpiValue}>
                {metric === 'revenue' || metric === 'commission'
                  ? `₹${chartData.values.reduce((a, b) => a + b, 0).toLocaleString()}`
                  : chartData.values.reduce((a, b) => a + b, 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>Peak period</Text>
              <Text style={styles.kpiValue}>
                {metric === 'revenue' || metric === 'commission'
                  ? `₹${Math.max(...chartData.values, 0).toLocaleString()}`
                  : Math.max(...chartData.values, 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>vs previous</Text>
              <Text style={[styles.kpiValue, { color: Colors.statusGreen }]}>
                {isDemoMode
                  ? '+14.2%'
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Bookings */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent bookings</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Rooms' as any)}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentBookings(4).map((b) => (
          <BookingItem
            key={b.id}
            booking={b}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: b.id })}
          />
        ))}

        {/* Upcoming Check-ins */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Upcoming check-ins</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Rooms' as any)}>
            <Text style={styles.seeAllText}>Manage</Text>
          </TouchableOpacity>
        </View>
        {upcomingCheckIns(3).map((b) => (
          <BookingItem
            key={b.id}
            booking={b}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: b.id })}
          />
        ))}

        {/* Recent Cab Trips */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent cab trips</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Cabs' as any)}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentTrips(3).map((t) => (
          <TripItem
            key={t.id}
            trip={t}
            onPress={() => navigation.navigate('CabRequestDetail', { tripId: t.id })}
          />
        ))}
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
    paddingBottom: 28,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 18,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.brandPrimary,
    fontWeight: '600',
  },
  statsGrid: {
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
  },
  quickGrid: {
    marginTop: 2,
  },
  quickRow: {
    flexDirection: 'row',
  },
  moreActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.bgCard,
  },
  moreActionsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  kpiRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 12,
    marginTop: 10,
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.button,
    borderWidth: 1,
    borderColor: Colors.brandPrimaryLight,
    backgroundColor: Colors.bgPage,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
  },
  chipsScroll: {
    marginVertical: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.bgPage,
    marginRight: 8,
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
});
