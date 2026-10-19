import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Header } from '../components/Header';
import { Colors, Radii, Shadows } from '../theme/colors';
import { api } from '../data/api';

export type LegalDoc = 'privacy' | 'terms' | 'refunds';

interface LegalPage {
  title: string;
  version: string;
  sections: { heading: string; body: string }[];
}

// Privacy Policy / Terms / Refunds, served by the server (always the current version; readable before sign-up)
// Also used inside sign-up sheets (props), where navigating would open the page behind the sheet
export const LegalScreen: React.FC<{ doc?: LegalDoc; onClose?: () => void }> = (props) => {
  const navigation = useNavigation<any>();
  const routeDoc = (useRoute<RouteProp<{ p: { doc?: LegalDoc } }, 'p'>>().params as { doc?: LegalDoc } | undefined)?.doc;
  const doc: LegalDoc = props.doc || routeDoc || 'privacy';
  const [page, setPage] = useState<LegalPage | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/public/legal/${doc}`)
      .then((p: LegalPage) => {
        if (!cancelled) setPage(p);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Could not load this page.');
      });
    return () => {
      cancelled = true;
    };
  }, [doc, attempt]);

  return (
    <View style={styles.container}>
      <Header title={page?.title || 'Legal'} onBack={props.onClose || (() => navigation.goBack())} />
      {!page && !error ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brandPrimary} />
      ) : error && !page ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retry}
            onPress={() => {
              setError('');
              setAttempt((n) => n + 1);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title} accessibilityRole="header">
            {page!.title}
          </Text>
          <Text style={styles.version}>Last updated {page!.version}</Text>
          {page!.sections.map((s) => (
            <View key={s.heading} style={styles.card}>
              <Text style={styles.heading} accessibilityRole="header">
                {s.heading}
              </Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  version: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radii.card, padding: 16, marginBottom: 10, ...Shadows.card },
  heading: { fontSize: 15, fontWeight: '700', color: Colors.brandPrimaryDark, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retry: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radii.button, backgroundColor: Colors.brandPrimary },
  retryText: { color: Colors.white, fontWeight: '700' },
});
