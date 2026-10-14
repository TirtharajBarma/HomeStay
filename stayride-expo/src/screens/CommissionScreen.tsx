import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { CabTrip } from '../types';

export const CommissionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { trips, payCommission } = useStayRide();

  const completedTrips = trips.filter((t) => t.status === 'COMPLETED' && t.commission > 0);

  const earned = completedTrips.reduce((acc, t) => acc + t.commission, 0);
  const paid = completedTrips
    .filter((t) => t.commissionPaid)
    .reduce((acc, t) => acc + t.commission, 0);
  const pending = earned - paid;

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

  const handleTogglePaid = async (t: CabTrip) => {
    const nextPaid = !t.commissionPaid;
    await payCommission(t.id, nextPaid);
    Alert.alert(
      'Status Updated',
      nextPaid
        ? `Marked as paid — ₹${t.commission.toLocaleString()}`
        : `Moved back to pending — ₹${t.commission.toLocaleString()}`
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Commission" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Pending Payout</Text>
          <Text style={styles.balanceVal}>₹{pending.toLocaleString()}</Text>
          <Text style={styles.summaryMeta}>
            Earned ₹{earned.toLocaleString()} · Paid ₹{paid.toLocaleString()} · 12% platform fee on every completed fare
          </Text>
        </View>

        <Text style={styles.sectionHeader}>Trip Commission Ledger</Text>
        <Text style={styles.subtext}>
          Tap any trip below to toggle payment status (Paid / Pending).
        </Text>

        {completedTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed trips with commission yet.</Text>
          </View>
        ) : (
          completedTrips.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.tripRow}
              onPress={() => handleTogglePaid(t)}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.tripTitle}>
                  {t.guestName} · {t.pickup} → {t.destination}
                </Text>
                <Text style={styles.tripMeta}>
                  {fmtDate(t.date)} · {t.vehicleType} · fare ₹{t.fare.toLocaleString()}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commissionAmount}>
                  +₹{t.commission.toLocaleString()}
                </Text>
                <View style={{ marginTop: 4 }}>
                  <Pill
                    type="payment"
                    value={t.commissionPaid ? 'PAID' : 'PENDING'}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 36,
  },
  balanceCard: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#EDE9FE',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  balanceVal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  summaryMeta: {
    fontSize: 12,
    color: '#EDE9FE',
    marginTop: 8,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  subtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tripRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  tripTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tripMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  commissionAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.statusGreen,
  },
});
