import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { DonutChart } from '../components/DonutChart';
import { BarChart } from '../components/BarChart';
import { Colors } from '../theme/colors';

const TYPE_COLORS = [
  Colors.brandPrimary,
  Colors.brandAccent,
  Colors.statusBlue,
  Colors.statusPurple,
  Colors.statusGreen,
  Colors.statusOrange,
];

export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { trips } = useStayRide();

  const [now] = React.useState(() => Date.now());
  const dayMs = 86400000;
  const cutoff = now - 30 * dayMs;

  let revenue30 = 0;
  let commission30 = 0;
  const byType: { [key: string]: number } = {};

  trips.forEach((t) => {
    if (t.status === 'CANCELLED') return;
    const val = t.fare > 0 ? t.fare : 0; // only real agreed fares
    if (t.status === 'COMPLETED' && t.date >= cutoff) {
      revenue30 += t.fare;
      commission30 += t.commission;
    }
    byType[t.vehicleType] = (byType[t.vehicleType] || 0) + val;
  });

  const pieSegments = Object.entries(byType).map(([label, value], idx) => ({
    label,
    value,
    color: TYPE_COLORS[idx % TYPE_COLORS.length],
  }));

  // Weekly bars for past 5 weeks
  const bars = [0, 1, 2, 3, 4].map((w) => {
    const start = now + (w - 4) * 7 * dayMs;
    const end = start + 7 * dayMs;
    let sum = 0;
    trips.forEach((t) => {
      if (t.status === 'CANCELLED') return;
      if (t.date >= start && t.date < end) {
        sum += t.fare > 0 ? t.fare : 0;
      }
    });
    const d = new Date(start);
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { label, value: sum };
  });

  return (
    <View style={styles.container}>
      <Header title="Analytics" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top 2 KPI Cards */}
        <View style={styles.row}>
          <View style={[styles.kpiCard, { marginRight: 8 }]}>
            <Text style={styles.kpiLabel}>Cab revenue (30d)</Text>
            <Text style={styles.kpiVal}>₹{revenue30.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, { marginLeft: 8 }]}>
            <Text style={styles.kpiLabel}>Commission (30d)</Text>
            <Text style={[styles.kpiVal, { color: Colors.statusGreen }]}>
              ₹{commission30.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Donut Chart: Revenue by Vehicle Type */}
        <Text style={styles.sectionTitle}>Revenue by trip type</Text>
        <View style={styles.chartCard}>
          {pieSegments.length > 0 ? (
            <DonutChart slices={pieSegments} size={180} />
          ) : (
            <Text style={styles.emptyChart}>No trip data recorded yet</Text>
          )}
        </View>

        {/* Bar Chart: Weekly Cab Revenue */}
        <Text style={styles.sectionTitle}>Weekly cab revenue</Text>
        <View style={styles.chartCard}>
          <BarChart
            labels={bars.map((b) => b.label)}
            values={bars.map((b) => b.value)}
            height={180}
          />
        </View>
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
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  kpiLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  kpiVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 210,
  },
  emptyChart: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
