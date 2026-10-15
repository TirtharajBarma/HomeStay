import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { CabTrip } from '../types';
import { api } from '../data/api';

export const CommissionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { trips, payCommission, session, commissionRates } = useStayRide();

  const completedTrips = trips.filter((t) => t.status === 'COMPLETED' && t.commission > 0);

  const earned = completedTrips.reduce((acc, t) => acc + t.commission, 0);
  const paid = completedTrips
    .filter((t) => t.commissionPaid)
    .reduce((acc, t) => acc + t.commission, 0);
  const pending = Math.max(0, earned - paid);

  // Payout Request Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fmtDate = (ms: number | string | Date) => {
    const d = new Date(ms);
    return isNaN(d.getTime())
      ? 'Recent'
      : d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        });
  };

  const fetchPayoutHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/payouts/history');
      if (Array.isArray(res)) {
        setPayoutHistory(res);
      }
    } catch {
      // offline / demo fallback
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchPayoutHistory();
  }, []);

  const openWithdrawModal = () => {
    if (pending <= 0) {
      Alert.alert('No Balance', 'You currently have ₹0 in pending commission to withdraw.');
      return;
    }
    setWithdrawAmount(String(pending));
    setModalVisible(true);
  };

  const handleRequestPayout = async () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payout amount.');
      return;
    }
    if (amt > pending) {
      Alert.alert(
        'Insufficient Pending Balance',
        `You cannot withdraw more than your pending commission of ₹${pending.toLocaleString()}.`
      );
      return;
    }
    if (!upiId.trim() || !upiId.includes('@')) {
      Alert.alert(
        'Invalid UPI ID',
        'Please enter a valid UPI address (e.g. yourname@okhdfcbank or 9800123456@paytm).'
      );
      return;
    }

    setSubmittingPayout(true);
    try {
      const res = await api.post('/payouts/request', {
        amount: amt,
        payoutMethod: 'UPI',
        upiId: upiId.trim(),
      });

      if (res && res.success) {
        Alert.alert(
          'Payout Request Submitted',
          `Your withdrawal request of ₹${amt.toLocaleString()} to ${upiId.trim()} has been logged for Super Admin settlement.`
        );
        setModalVisible(false);
        fetchPayoutHistory();
      } else {
        throw new Error(res?.error?.message || 'Could not submit payout request.');
      }
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Could not reach server. Please try again.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Homestay Commission" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available Commission Balance</Text>
            <View style={styles.escrowBadge}>
              <Text style={styles.escrowBadgeText}>🔒 Secured in Escrow</Text>
            </View>
          </View>

          <Text style={styles.balanceVal}>₹{pending.toLocaleString()}</Text>

          <Text style={styles.summaryMeta}>
            Lifetime Earned: ₹{earned.toLocaleString()} · Already Paid Out: ₹{paid.toLocaleString()}
          </Text>

          {/* Withdraw Button */}
          <TouchableOpacity
            style={[styles.withdrawButton, pending <= 0 && styles.withdrawButtonDisabled]}
            disabled={pending <= 0}
            onPress={openWithdrawModal}
          >
            <Text style={styles.withdrawButtonText}>
              {pending > 0 ? `Redeem ₹${pending.toLocaleString()} to UPI` : 'No Pending Payout'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payout History Section */}
        {payoutHistory.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionHeader}>Payout Settlements</Text>
            <Text style={styles.subtext}>Bank & UPI transfers from Super Admin platform escrow.</Text>

            {payoutHistory.map((p: any) => (
              <View key={p._id || p.id} style={styles.payoutHistoryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutHistoryTitle}>
                    ₹{p.amount?.toLocaleString()} · {p.upiId || 'Bank Transfer'}
                  </Text>
                  <Text style={styles.payoutHistoryMeta}>
                    Requested: {fmtDate(p.requestedAt || p.createdAt)}
                    {p.utrNumber ? ` · Ref: ${p.utrNumber}` : ''}
                  </Text>
                </View>

                <View
                  style={[
                    styles.payoutBadge,
                    p.status === 'SETTLED' ? styles.badgeSettled : styles.badgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.payoutBadgeText,
                      p.status === 'SETTLED' ? styles.textSettled : styles.textPending,
                    ]}
                  >
                    {p.status === 'SETTLED' ? '✓ TRANSFERRED' : '⏳ PENDING'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Trip Commission Ledger */}
        <Text style={styles.sectionHeader}>Trip Commission Breakdown</Text>
        <Text style={styles.subtext}>
          Dynamic homestay commission earned from guest mountain cab bookings.
          {commissionRates
            ? ` Platform fee ${commissionRates.pfPercent}% · Homestay commission ${commissionRates.hcPercent}%.`
            : ''}
        </Text>

        {completedTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed trips with commission yet.</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, color: Colors.textTertiary }]}>
              Commissions credit automatically whenever your guests complete verified cab itineraries.
            </Text>
          </View>
        ) : (
          completedTrips.map((t) => (
            <View key={t.id} style={styles.tripRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.tripTitle}>
                  {t.guestName} · {t.pickup} → {t.destination}
                </Text>
                <Text style={styles.tripMeta}>
                  {fmtDate(t.date)} · {t.vehicleType} · Trip Fare: ₹{t.fare.toLocaleString()}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commissionAmount}>+₹{t.commission.toLocaleString()}</Text>
                <View style={{ marginTop: 4 }}>
                  <Pill type="payment" value={t.commissionPaid ? 'PAID' : 'PENDING'} />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Payout Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Redeem Commission</Text>
            <Text style={styles.modalSub}>
              Enter your UPI ID to receive direct bank transfer from StayRide platform escrow.
            </Text>

            <View style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>Withdrawal Amount (₹)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Enter amount"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.helperText}>Max available: ₹{pending.toLocaleString()}</Text>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Your UPI ID *</Text>
              <TextInput
                style={styles.textInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g. host@okhdfcbank or 9800123456@paytm"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
              <Text style={styles.helperText}>
                Transfers are processed within 24 hours directly to your linked bank account.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
                disabled={submittingPayout}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.submitBtn]}
                onPress={handleRequestPayout}
                disabled={submittingPayout}
              >
                {submittingPayout ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Payout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#EDE9FE',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  escrowBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  escrowBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  balanceVal: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 6,
  },
  summaryMeta: {
    fontSize: 12,
    color: '#EDE9FE',
    marginTop: 6,
    lineHeight: 16,
  },
  withdrawButton: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
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
    textAlign: 'center',
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
  payoutHistoryRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  payoutHistoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  payoutHistoryMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  payoutBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSettled: {
    backgroundColor: '#D1FAE5',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  payoutBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textSettled: {
    color: '#065F46',
  },
  textPending: {
    color: '#92400E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  helperText: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 3,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: Colors.brandPrimary,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
