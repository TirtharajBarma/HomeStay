import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { formatINR } from '../utils/format';

export const DriverEarningsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { trips, session } = useStayRide();

  const driverId = Number(session?.driver?.id) || 1;
  const driverName = session?.driver?.name || 'Local Driver';

  const completedTrips = trips.filter(
    (t) =>
      (t.driverId === driverId || (t.driverName && t.driverName.toLowerCase().includes(driverName.toLowerCase()))) &&
      t.status === 'COMPLETED'
  );

  const totalGrossFares = completedTrips.reduce((acc, t) => acc + (t.fare || t.estFare || 3000), 0);
  const totalHostCommission = completedTrips.reduce(
    (acc, t) => acc + (t.commission ?? 0),
    0
  );
  const totalPlatformFees = completedTrips.reduce(
    (acc, t) => acc + (t.financialSnapshot?.platformFeeAmount ?? t.platformFee ?? 0),
    0
  );
  const totalCashCollected = completedTrips.reduce(
    (acc, t) => acc + Math.max(0, (t.fare || 0) - (t.advancePaid ? t.advanceAmount || 0 : 0)),
    0
  );
  const netEarnings = totalGrossFares - totalHostCommission - totalPlatformFees;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, Platform.OS === 'ios' ? 54 : 38) }]}>
        <Text style={styles.headerTitle}>Driver Earnings &amp; Ledger</Text>
        <Text style={styles.headerSubtitle}>Direct Mountain Cash &amp; Commission Breakdown</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main Payout Card */}
        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>NET DRIVER EARNINGS</Text>
          <Text style={styles.highlightValue}>{formatINR(netEarnings)}</Text>
          <Text style={styles.highlightSub}>From {completedTrips.length} completed mountain trips</Text>
        </View>

        {/* 2-Column Stats Grid */}
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="cash-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.gridLabel}>Cash Collected</Text>
            <Text style={styles.gridValue}>{formatINR(totalCashCollected)}</Text>
            <Text style={styles.gridSub}>In hand from guests</Text>
          </View>
          <View style={styles.gridCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="car-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.gridLabel}>Rides Completed</Text>
            <Text style={styles.gridValue}>{completedTrips.length}</Text>
            <Text style={styles.gridSub}>100% verified trips</Text>
          </View>
        </View>

        {/* Commission Transparency Breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.sectionTitle}>Commission &amp; Fee Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.rowLabel}>Total Gross Fare Value:</Text>
            <Text style={styles.rowVal}>{formatINR(totalGrossFares)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.rowLabel}>Homestay Host Commission (~10%):</Text>
            <Text style={[styles.rowVal, { color: '#DC2626' }]}>- {formatINR(totalHostCommission)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.rowLabel}>Platform Tech Fee (~5%):</Text>
            <Text style={[styles.rowVal, { color: '#DC2626' }]}>- {formatINR(totalPlatformFees)}</Text>
          </View>
          <View style={[styles.breakdownRow, styles.totalRow]}>
            <Text style={styles.totalRowLabel}>Net Payout to You:</Text>
            <Text style={styles.totalRowVal}>{formatINR(netEarnings)}</Text>
          </View>
        </View>

        {/* Recent Trip Payouts */}
        <View style={styles.historyCard}>
          <Text style={styles.sectionTitle}>Trip Settlements</Text>
          {completedTrips.length === 0 ? (
            <Text style={styles.emptyText}>No completed trip payouts yet.</Text>
          ) : (
            completedTrips.map((t) => (
              <View key={t.id} style={styles.tripSettlement}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripRider}>{t.guestName}</Text>
                  <Text style={styles.tripRoute}>{t.pickup} ➔ {t.destination}</Text>
                  <Text style={styles.tripDate}>
                    {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.tripFare}>+ ₹{t.fare || 3000}</Text>
                  <Text style={styles.tripSettledBadge}>Settled</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  highlightCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    ...Shadows.md,
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  highlightValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 6,
  },
  highlightSub: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  gridValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  gridSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  rowLabel: {
    fontSize: 13,
    color: '#475569',
  },
  rowVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
  },
  totalRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalRowVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  tripSettlement: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tripRider: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  tripRoute: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  tripDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  tripFare: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A',
  },
  tripSettledBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
});
