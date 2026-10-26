import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { formatINR } from '../utils/format';
import { api } from '../data/api';

export const DriverEarningsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { driverTrips } = useStayRide();

  // Driver Wallet state
  const [wallet, setWallet] = useState<{
    available: number;
    eligibleTrips: number;
    trips: Array<{ reference: string; date: number; time: string; amount: number }>;
    pendingPayout: { id: string; amount: number; requestedAt: any } | null;
    history?: Array<{
      id: string;
      amount: number;
      status: string;
      method: string;
      upiId?: string;
      settlementReference?: string;
      requestedAt?: string;
      settledAt?: string;
      rejectionReason?: string;
    }>;
  } | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // UPI Payout Request Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      setLoadingWallet(true);
      const res: any = await api.get('/driver/wallet');
      if (res && typeof res.available === 'number') {
        setWallet(res);
      }
    } catch {
      // Keep existing data on network glitch
    } finally {
      setLoadingWallet(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.get('/driver/wallet');
        if (!cancelled && res && typeof res.available === 'number') {
          setWallet(res);
        }
      } catch {
        // Keep existing data on network glitch
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const handleRequestPayout = async () => {
    const trimmed = upiId.trim();
    if (!trimmed || !/^[\w.\-]{2,}@[\w]{2,}$/.test(trimmed)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI address (e.g. 9832012345@paytm or name@oksbi).');
      return;
    }
    try {
      setSubmitting(true);
      const res: any = await api.post('/driver/payouts/request', { method: 'UPI', upiId: trimmed });
      Alert.alert(
        'Payout Requested',
        res?.message || `Payout request for ${formatINR(wallet?.available ?? 0)} submitted. Admin will transfer directly to your UPI ID.`
      );
      setModalVisible(false);
      setUpiId('');
      fetchWallet();
    } catch (e: any) {
      Alert.alert('Payout Request Failed', e?.message || 'Could not request payout. Please check your balance and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const completedTrips = driverTrips.filter((t) => t.assignedToMe && t.status === 'COMPLETED');
  const sumNet = (list: typeof completedTrips) =>
    list.reduce((sum, t) => sum + (typeof t.driverNetPayout === 'number' ? t.driverNetPayout : 0), 0);
  const settledTotal = sumNet(completedTrips.filter((t) => t.driverSettlementStatus === 'SETTLED'));
  const pendingTotal = sumNet(completedTrips.filter((t) => t.driverSettlementStatus !== 'SETTLED'));
  const money = (v?: number | null) => (typeof v === 'number' ? formatINR(v) : '—');

  const availableBalance = wallet?.available ?? 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, Platform.OS === 'ios' ? 54 : 38) }]}>
        <Text style={styles.headerTitle}>Driver Earnings &amp; Wallet</Text>
        <Text style={styles.headerSubtitle}>Sovereign balance and automated ride ledger</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16A34A']} />}
      >
        {/* Sovereign Driver Wallet Card */}
        <View style={styles.walletHeroCard}>
          <View style={styles.walletHeaderRow}>
            <View>
              <Text style={styles.walletHeroLabel}>AVAILABLE FOR UPI WITHDRAWAL</Text>
              <Text style={styles.walletHeroValue}>{formatINR(availableBalance)}</Text>
            </View>
            <View style={styles.walletIconCircle}>
              <Ionicons name="wallet" size={26} color="#FFFFFF" />
            </View>
          </View>

          {wallet?.pendingPayout ? (
            <View style={styles.pendingBadgeBox}>
              <Ionicons name="hourglass-outline" size={16} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingBadgeText}>
                  Pending UPI Transfer: {formatINR(wallet.pendingPayout.amount)}
                </Text>
                <Text style={styles.pendingBadgeSub}>
                  Admin is processing your transfer. UTR will be updated once transferred.
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.withdrawBtn, availableBalance < 100 && { opacity: 0.5 }]}
              disabled={availableBalance < 100}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="flash" size={16} color="#0F172A" />
              <Text style={styles.withdrawBtnText}>
                {availableBalance < 100 ? 'Min Balance ₹100 to Withdraw' : `Withdraw ${formatINR(availableBalance)} via UPI`}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.walletNote}>
            Excess advance deposits over StayRide platform commission are credited to your wallet instantly upon ride completion.
          </Text>
        </View>

        {/* Overview Stats */}
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="car-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.gridLabel}>Rides Completed</Text>
            <Text style={styles.gridValue}>{completedTrips.length}</Text>
          </View>
          <View style={styles.gridCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-done-circle-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.gridLabel}>Total Settled</Text>
            <Text style={styles.gridValue}>{formatINR(settledTotal)}</Text>
            <Text style={styles.gridSub}>Pending {formatINR(pendingTotal)}</Text>
          </View>
        </View>

        {/* Payout & UTR Settlement History */}
        {wallet?.history && wallet.history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Recent UPI Payouts</Text>
            {wallet.history.map((h) => (
              <View key={h.id} style={styles.payoutHistoryItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutAmount}>{formatINR(h.amount)}</Text>
                  <Text style={styles.payoutDetail}>UPI: {h.upiId || 'Direct VPA'}</Text>
                  {!!h.settlementReference && (
                    <Text style={styles.payoutUtr}>Bank UTR: {h.settlementReference}</Text>
                  )}
                  {!!h.rejectionReason && (
                    <Text style={styles.payoutReject}>Rejected: {h.rejectionReason}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View
                    style={[
                      styles.statusPill,
                      h.status === 'SETTLED'
                        ? { backgroundColor: '#ECFDF5' }
                        : h.status === 'REJECTED'
                        ? { backgroundColor: '#FEF2F2' }
                        : { backgroundColor: '#FEF3C7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        h.status === 'SETTLED'
                          ? { color: '#059669' }
                          : h.status === 'REJECTED'
                          ? { color: '#DC2626' }
                          : { color: '#D97706' },
                      ]}
                    >
                      {h.status}
                    </Text>
                  </View>
                  <Text style={styles.payoutDate}>
                    {h.requestedAt ? new Date(h.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Per-trip payout breakdown */}
        <View style={styles.historyCard}>
          <Text style={styles.sectionTitle}>Completed Trips Breakdown</Text>
          {completedTrips.length === 0 ? (
            <Text style={styles.emptyText}>No completed trips yet.</Text>
          ) : (
            completedTrips.map((t) => (
              <View key={t.reference} style={styles.tripSettlement}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripRider}>{t.guestName || t.reference}</Text>
                  <Text style={styles.tripRoute}>{t.pickup} ➔ {t.destination}</Text>
                  <Text style={styles.tripDate}>
                    {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={styles.tripDate}>
                    Fare {money(t.fare)} • Platform fee {money(t.platformFeeAmount)} • Homestay commission{' '}
                    {money(t.homestayCommissionAmount)}
                  </Text>
                  <Text style={styles.tripDate}>
                    Cash collected in car: {money(t.remainingCashAmount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.tripFare}>{money(t.driverNetPayout)}</Text>
                  <Text style={styles.tripDate}>Total net payout</Text>
                  <Text style={styles.tripSettledBadge}>
                    {t.driverSettlementStatus === 'SETTLED'
                      ? 'Settled'
                      : t.driverSettlementStatus === 'PENDING'
                      ? 'Settlement pending'
                      : 'Completed'}
                  </Text>
                  {!!t.driverSettlementReference && (
                    <Text style={styles.tripDate}>Ref {t.driverSettlementReference}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* UPI Withdrawal Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request UPI Payout</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Available balance: <Text style={{ fontWeight: '800', color: '#16A34A' }}>{formatINR(availableBalance)}</Text>
            </Text>
            <Text style={styles.modalHint}>
              Enter your Google Pay, PhonePe, or Paytm UPI ID. Funds are transferred manually by StayRide Admin with full bank UTR confirmation.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 9832012345@paytm or name@oksbi"
              placeholderTextColor="#94A3B8"
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                disabled={submitting}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!upiId.trim() || submitting) && { opacity: 0.5 }]}
                disabled={!upiId.trim() || submitting}
                onPress={handleRequestPayout}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Confirm &amp; Request</Text>
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
  walletHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Shadows.md,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  walletHeroValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#34D399',
    marginTop: 4,
  },
  walletIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawBtn: {
    backgroundColor: '#34D399',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  withdrawBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  pendingBadgeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pendingBadgeText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
  },
  pendingBadgeSub: {
    color: '#B45309',
    fontSize: 10,
    marginTop: 2,
  },
  walletNote: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
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
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  payoutHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  payoutAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  payoutDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  payoutUtr: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  payoutReject: {
    fontSize: 10,
    color: '#DC2626',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  payoutDate: {
    fontSize: 10,
    color: '#94A3B8',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    ...Shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 18,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
