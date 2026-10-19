import React, { useState, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { FeatureLocked } from '../components/FeatureLocked';
import { api } from '../data/api';
import { formatINR } from '../utils/format';

export const CommissionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { trips, commissionRates, features, payoutSummary, refreshPayoutSummary } = useStayRide();

  // Display-only ledger: commission values come from the server (earned only on platform trips)
  const completedTrips = trips.filter((t) => t.platform && t.commission > 0);

  // Withdrawable balance is computed only by the server (GET /payouts/summary)
  const available = payoutSummary?.available ?? 0;
  const pendingPayout = payoutSummary?.pendingPayout ?? null;
  const payoutsLocked = features?.payouts === false;

  // Payout Request Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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
      if (!Array.isArray(res)) throw new Error('Unexpected reply from StayRide.');
      setPayoutHistory(res);
      setHistoryError(null);
    } catch (e: any) {
      // Never show an empty history when we simply could not load it
      setHistoryError(e?.message && !/network|abort/i.test(e.message) ? e.message : 'No connection to StayRide.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const refresh = useCallback(() => {
    refreshPayoutSummary().catch(() => {});
    fetchPayoutHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(refresh);

  const openWithdrawModal = () => {
    if (available <= 0) {
      Alert.alert('No Balance', 'You have no commission available to withdraw yet.');
      return;
    }
    setModalVisible(true);
  };

  // Closing the form ends this submission; reopening it creates a new Idempotency-Key
  const closeWithdrawModal = () => {
    setModalVisible(false);
    api.clearIdempotencyKeys('/payouts/request');
  };

  // Requests the FULL server-computed balance; the server rejects it if the balance changed meanwhile
  const handleRequestPayout = async () => {
    let destination: Record<string, unknown>;
    if (payoutMethod === 'UPI') {
      if (!upiId.trim() || !upiId.includes('@')) {
        Alert.alert(
          'Invalid UPI ID',
          'Please enter a valid UPI address (e.g. yourname@okhdfcbank or 9800123456@paytm).'
        );
        return;
      }
      destination = { upiId: upiId.trim() };
    } else {
      const cleanIfsc = ifsc.trim().toUpperCase();
      const cleanAccount = accountNumber.replace(/\s/g, '');
      if (!accountName.trim()) {
        Alert.alert('Account Name Required', 'Enter the name on the bank account.');
        return;
      }
      if (!/^\d{9,18}$/.test(cleanAccount)) {
        Alert.alert('Invalid Account Number', 'Bank account numbers have 9 to 18 digits.');
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        Alert.alert('Invalid IFSC', 'IFSC is 11 characters, like SBIN0001234 (5th character is 0).');
        return;
      }
      destination = {
        bank: {
          accountName: accountName.trim().slice(0, 100),
          accountNumber: cleanAccount,
          ifsc: cleanIfsc,
          ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
        },
      };
    }

    setSubmittingPayout(true);
    try {
      const res = await api.post('/payouts/request', {
        method: payoutMethod,
        payoutMethod,
        ...destination,
        expectedAmount: available,
      });
      Alert.alert('Payout Request Submitted', res?.message || 'Your payout request was submitted to StayRide.');
      closeWithdrawModal();
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Could not reach server. Please try again.');
    } finally {
      refresh();
      setSubmittingPayout(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Homestay Commission" onBack={() => navigation.goBack()} />

      <FormScroll contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available Commission Balance</Text>
            <View style={styles.escrowBadge}>
              <Text style={styles.escrowBadgeText}>Held by StayRide</Text>
            </View>
          </View>

          <Text style={styles.balanceVal}>{payoutSummary ? formatINR(available) : '—'}</Text>

          {payoutSummary && (
            <Text style={styles.summaryMeta}>
              From {payoutSummary.eligibleTrips} completed StayRide trip{payoutSummary.eligibleTrips === 1 ? '' : 's'}
              {pendingPayout ? ` · Payout of ${formatINR(pendingPayout.amount)} pending` : ''}
            </Text>
          )}

          {/* Withdraw Button */}
          {!payoutsLocked && (
            <TouchableOpacity
              style={[styles.withdrawButton, (available <= 0 || !!pendingPayout) && styles.withdrawButtonDisabled]}
              disabled={available <= 0 || !!pendingPayout}
              onPress={openWithdrawModal}
            >
              <Text style={styles.withdrawButtonText}>
                {pendingPayout
                  ? 'Payout request pending'
                  : available > 0
                  ? `Request ${formatINR(available)} payout`
                  : 'Nothing to withdraw yet'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {payoutsLocked && <FeatureLocked feature="payouts" title="Commission payouts" />}

        {/* Payout History Section */}
        {historyError && (
          <View style={[styles.emptyCard, { marginBottom: 20 }]}>
            <Text style={styles.emptyText}>Could not load payout history. {historyError}</Text>
            <TouchableOpacity onPress={fetchPayoutHistory} disabled={loadingHistory} style={{ marginTop: 8 }}>
              <Text style={[styles.emptyText, { color: Colors.brandPrimary, fontWeight: '700' }]}>
                {loadingHistory ? 'Loading…' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {!historyError && payoutHistory.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionHeader}>Payout Settlements</Text>
            <Text style={styles.subtext}>Bank & UPI transfers from Super Admin platform escrow.</Text>

            {payoutHistory.map((p: any) => (
              <View key={p._id || p.id} style={styles.payoutHistoryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutHistoryTitle}>
                    ₹{p.amount?.toLocaleString()} ·{' '}
                    {p.method === 'BANK_TRANSFER' || (!p.upiId && p.bank)
                      ? `Bank transfer ${p.bank?.bankName ? `${p.bank.bankName} ` : ''}${p.bank?.accountNumber ? `A/c ${p.bank.accountNumber}` : ''}`
                      : `UPI ${p.upiId || ''}`}
                  </Text>
                  <Text style={styles.payoutHistoryMeta}>
                    Requested: {fmtDate(p.requestedAt || p.createdAt)}
                    {p.utrNumber ? ` · Ref: ${p.utrNumber}` : ''}
                  </Text>
                  {p.status === 'REJECTED' && p.rejectedReason ? (
                    <Text style={[styles.payoutHistoryMeta, styles.textRejected]}>Reason: {p.rejectedReason}</Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.payoutBadge,
                    p.status === 'SETTLED' ? styles.badgeSettled : p.status === 'REJECTED' ? styles.badgeRejected : styles.badgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.payoutBadgeText,
                      p.status === 'SETTLED' ? styles.textSettled : p.status === 'REJECTED' ? styles.textRejected : styles.textPending,
                    ]}
                  >
                    {p.status === 'SETTLED' ? '✓ SETTLED' : p.status === 'REJECTED' ? 'REJECTED' : '⏳ PENDING'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Trip Commission Ledger */}
        <Text style={styles.sectionHeader}>Trip Commission Breakdown</Text>
        <Text style={styles.subtext}>
          Your commission per completed StayRide trip. EARNED can be withdrawn, REQUESTED is in your payout
          request, PAID was transferred to you.
          {commissionRates
            ? ` Platform fee ${commissionRates.pfPercent}% · Homestay commission ${commissionRates.hcPercent}%.`
            : ''}
        </Text>

        {completedTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed trips with commission yet.</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, color: Colors.textTertiary }]}>
              Commission is credited once a trip is completed and the guest&apos;s advance is paid.
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
                  {fmtDate(t.date)} · {t.vehicleType} · Trip Fare: {formatINR(t.fare)}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commissionAmount}>+{formatINR(t.commission)}</Text>
                <View style={{ marginTop: 4 }}>
                  {/* Earned → in a payout request → paid out */}
                  {t.commissionPaid ? (
                    <Pill value="PAID" label="PAID" />
                  ) : t.payoutId ? (
                    <Pill value="CONFIRMED" label="REQUESTED" />
                  ) : (
                    <Pill value="PENDING" label="EARNED" />
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </FormScroll>

      {/* Payout Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeWithdrawModal}>
        <KeyboardAwareOverlay style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Redeem Commission</Text>
            <Text style={styles.modalSub}>
              Choose how StayRide should pay you: UPI or bank transfer.
            </Text>

            <View style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>Amount</Text>
              <Text style={styles.modalTitle}>{formatINR(available)}</Text>
              <Text style={styles.helperText}>Your full available balance is requested.</Text>
            </View>

            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              {(['UPI', 'BANK_TRANSFER'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayoutMethod(m)}
                  style={[styles.modalBtn, payoutMethod === m ? styles.submitBtn : styles.cancelBtn]}
                >
                  <Text style={payoutMethod === m ? styles.submitBtnText : styles.cancelBtnText}>
                    {m === 'UPI' ? 'UPI' : 'Bank transfer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {payoutMethod === 'BANK_TRANSFER' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Account holder name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={accountName}
                  onChangeText={setAccountName}
                  maxLength={100}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Account number *</Text>
                <TextInput
                  style={styles.textInput}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  maxLength={18}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>IFSC *</Text>
                <TextInput
                  style={styles.textInput}
                  value={ifsc}
                  onChangeText={(v) => setIfsc(v.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={11}
                  placeholder="e.g. SBIN0001234"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Bank name</Text>
                <TextInput
                  style={styles.textInput}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            ) : (
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
            </View>
            )}
            <Text style={styles.helperText}>StayRide reviews and settles payout requests.</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={closeWithdrawModal}
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
        </KeyboardAwareOverlay>
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
  badgeRejected: {
    backgroundColor: Colors.statusRedBg,
  },
  textRejected: {
    color: Colors.statusRed,
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
