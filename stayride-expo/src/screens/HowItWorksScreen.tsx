import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { ownFleetFeeFor } from '../data/platformConfig';

const EXAMPLE_FARE = 3000;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

type IconName = keyof typeof Ionicons.glyphMap;

const Step: React.FC<{ n: number; icon: IconName; title: string; text: string }> = ({ n, icon, title, text }) => (
  <View style={styles.step}>
    <View style={styles.stepBadge}>
      <Text style={styles.stepNum}>{n}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <View style={styles.stepTitleRow}>
        <Ionicons name={icon} size={16} color={Colors.brandPrimaryDark} />
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  </View>
);

const Row: React.FC<{ label: string; value: string; strong?: boolean; accent?: boolean }> = ({ label, value, strong, accent }) => (
  <View style={styles.moneyRow}>
    <Text style={[styles.moneyLabel, strong && styles.moneyStrong]}>{label}</Text>
    <Text style={[styles.moneyValue, strong && styles.moneyStrong, accent && { color: Colors.statusGreen }]}>{value}</Text>
  </View>
);

// "How StayRide works": the whole homestay + cab flow, with the real fees from the server.
export const HowItWorksScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { commissionRates, config } = useStayRide();

  // Same split rule as the server (advance = max(minimum, advance %, platform fee + commission))
  const pf = commissionRates?.pfPercent ?? 0;
  const hc = commissionRates?.hcPercent ?? 0;
  const pfAmt = Math.round((EXAMPLE_FARE * pf) / 100);
  const hcAmt = Math.round((EXAMPLE_FARE * hc) / 100);
  const advance = Math.min(
    EXAMPLE_FARE,
    Math.max(commissionRates?.minAdvanceAmount ?? 0, Math.round((EXAMPLE_FARE * (commissionRates?.advancePercent ?? 0)) / 100), pfAmt + hcAmt)
  );
  const ownFee = ownFleetFeeFor(config, EXAMPLE_FARE);

  return (
    <View style={styles.container}>
      <Header title="How StayRide works" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="trail-sign" size={30} color={Colors.white} />
          <Text style={styles.heroTitle}>Your homestay and your guests&apos; rides, in one app</Text>
          <Text style={styles.heroText}>Manage rooms and bookings, and earn on every cab your guests take.</Text>
        </View>

        <Text style={styles.section}>Run your homestay</Text>
        <View style={styles.card}>
          <Step n={1} icon="bed" title="Set up rooms" text="Add rooms and prices, and pin your homestay on the map so nearby drivers can find you." />
          <Step n={2} icon="calendar" title="Take bookings" text="Book from the calendar, record advances and balances, and sync dates with Airbnb or Booking.com." />
          <Step n={3} icon="key" title="Check guests in and out" text="Room status updates itself from bookings. Share a receipt from your phone at checkout." />
        </View>

        <Text style={styles.section}>Get your guest a cab: 3 ways</Text>
        <View style={styles.wayCard}>
          <View style={styles.wayHead}>
            <Ionicons name="logo-whatsapp" size={18} color={Colors.statusGreen} />
            <Text style={styles.wayTitle}>Ask your guest</Text>
          </View>
          <Text style={styles.wayText}>
            StayRide WhatsApps a checked-in guest a link. Their request appears in Cabs → Guest inquiries, where you choose nearby drivers or your own.
          </Text>
        </View>
        <View style={styles.wayCard}>
          <View style={styles.wayHead}>
            <Ionicons name="navigate" size={18} color={Colors.brandPrimaryDark} />
            <Text style={styles.wayTitle}>Nearby StayRide drivers</Text>
          </View>
          <Text style={styles.wayText}>
            Drivers near your homestay with the right seats get the request and quote a fare. Accept a quote or send a counter-offer. The guest then pays a small advance to StayRide, and the rest in cash to the driver.
          </Text>
        </View>
        <View style={styles.wayCard}>
          <View style={styles.wayHead}>
            <Ionicons name="people" size={18} color={Colors.statusBlue} />
            <Text style={styles.wayTitle}>Your own drivers</Text>
          </View>
          <Text style={styles.wayText}>
            Pick a driver from your fleet and enter the fare you agreed. The guest pays StayRide&apos;s small own-fleet fee as the advance; the rest goes to your driver.
          </Text>
        </View>

        <Text style={styles.section}>The money on a {inr(EXAMPLE_FARE)} trip</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>With a StayRide driver</Text>
          <Row label="Fare quoted by the driver" value={inr(EXAMPLE_FARE)} strong />
          <Row label={`Your commission (${hc}%)`} value={`+${inr(hcAmt)}`} accent />
          <Row label={`StayRide platform fee (${pf}%)`} value={inr(pfAmt)} />
          <Row label="Guest pays StayRide now (advance)" value={inr(advance)} />
          <Row label="Guest pays the driver in cash" value={inr(EXAMPLE_FARE - advance)} />
          <View style={styles.divider} />
          <Text style={styles.cardLabel}>With your own driver</Text>
          <Row label="Fare you agreed with your driver" value={inr(EXAMPLE_FARE)} strong />
          <Row label={`StayRide fee (${config.ownFleetFeePercent}%, min ${inr(config.ownFleetMinFee)}), as the advance`} value={inr(ownFee)} />
          <Row label="Your driver gets in cash" value={inr(EXAMPLE_FARE - ownFee)} />
          <Text style={styles.note}>Rates are set by StayRide and shown on every quote before you confirm.</Text>
        </View>

        <Text style={styles.section}>Getting paid</Text>
        <View style={styles.card}>
          <Step n={1} icon="checkmark-circle" title="Earned" text="Your commission counts once the trip is completed and the guest's advance was paid." />
          <Step n={2} icon="cash" title="Requested" text="Tap Redeem in Cab commission to request everything earned, by UPI or bank transfer." />
          <Step n={3} icon="wallet" title="Paid" text="StayRide transfers it and marks the payout settled with a reference number." />
        </View>

        <Text style={styles.section}>Safe for everyone</Text>
        <View style={styles.card}>
          {[
            'Guest and driver phone numbers are shared only after the advance is paid.',
            'Drivers cannot put phone numbers or links in their quotes.',
            'Every fee is shown before you confirm. No hidden charges.',
            'If a paid trip is cancelled before it starts, the advance is refunded.',
          ].map((t) => (
            <View key={t} style={styles.safeRow}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.statusGreen} />
              <Text style={styles.safeText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('FindDriver')} accessibilityRole="button">
            <Text style={styles.ctaText}>Book a cab</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cta, styles.ctaOutline]} onPress={() => navigation.navigate('Commission')} accessibilityRole="button">
            <Text style={[styles.ctaText, { color: Colors.brandPrimaryDark }]}>My commission</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: Colors.brandPrimaryDark, borderRadius: Radii.dialog, padding: 20, ...Shadows.hover },
  heroTitle: { color: Colors.white, fontSize: 20, fontWeight: '800', marginTop: 10, lineHeight: 26 },
  heroText: { color: '#E9E3FF', fontSize: 14, marginTop: 6, lineHeight: 20 },
  section: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radii.card, padding: 16, ...Shadows.card },
  cardLabel: { fontSize: 13, fontWeight: '700', color: Colors.brandPrimaryDark, marginBottom: 6 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 13, fontWeight: '800', color: Colors.brandPrimaryDark },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  stepText: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 19 },
  wayCard: { backgroundColor: Colors.bgCard, borderRadius: Radii.card, padding: 14, marginBottom: 8, ...Shadows.card },
  wayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wayTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  wayText: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 19 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 12 },
  moneyLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  moneyValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  moneyStrong: { color: Colors.textPrimary, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },
  note: { fontSize: 11, color: Colors.textTertiary, marginTop: 10 },
  safeRow: { flexDirection: 'row', gap: 8, paddingVertical: 5, alignItems: 'flex-start' },
  safeText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cta: { flex: 1, paddingVertical: 14, borderRadius: Radii.button, backgroundColor: Colors.brandPrimary, alignItems: 'center' },
  ctaOutline: { backgroundColor: Colors.brandPrimaryLight },
  ctaText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
