import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Colors, Radii, Shadows } from '../theme/colors';
import { api } from '../data/api';
import { getFallbackLegalDoc } from '../constants/legalContent';

export type LegalDoc = 'privacy' | 'terms' | 'refunds';

interface LegalPage {
  title: string;
  version: string;
  sections: { heading: string; body: string }[];
}

const DOC_CONFIG: Record<
  LegalDoc,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tagline: string;
    highlights: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[];
  }
> = {
  privacy: {
    label: 'Privacy Policy',
    icon: 'shield-checkmark',
    tagline: 'Your personal data is encrypted, strictly protected, and never sold.',
    highlights: [
      { icon: 'lock-closed', title: 'Bank-Grade Security', desc: 'AES-256 at rest, TLS 1.3 in transit' },
      { icon: 'eye-off', title: 'Zero Trackers', desc: 'No advertising cookies or data monetization' },
      { icon: 'location', title: 'Minimal Location', desc: 'Used only while online to dispatch nearby hill rides' },
    ],
  },
  terms: {
    label: 'Terms of Service',
    icon: 'document-text',
    tagline: 'Clear, fair, and transparent guidelines for hosts, drivers, and guests.',
    highlights: [
      { icon: 'people', title: 'Independent Partners', desc: 'Direct connection between homestays & local mountain drivers' },
      { icon: 'pricetag', title: 'Zero Hidden Fees', desc: 'Quotes and advance amounts are displayed upfront' },
      { icon: 'trail-sign', title: 'Mountain Fair Use', desc: 'Protections against landslides, road closures & weather' },
    ],
  },
  refunds: {
    label: 'Refund Policy',
    icon: 'cash',
    tagline: 'Fair weather policy with 100% full refunds for verified hill roadblocks.',
    highlights: [
      { icon: 'checkmark-circle', title: '100% Weather Refund', desc: 'Full refund for road blocks, landslides, or breakdowns' },
      { icon: 'time', title: '5–7 Days Processing', desc: 'Direct refund back to your original payment method' },
      { icon: 'car', title: 'Driver Lock-in Fee', desc: 'Protects local drivers from no-shows once arrived' },
    ],
  },
};

function getSectionIcon(heading: string): keyof typeof Ionicons.glyphMap {
  const h = heading.toLowerCase();
  if (h.includes('who we are') || h.includes('about')) return 'business-outline';
  if (h.includes('collect')) return 'layers-outline';
  if (h.includes('why we use') || h.includes('what we do')) return 'sparkles-outline';
  if (h.includes('share')) return 'share-social-outline';
  if (h.includes('location')) return 'navigate-outline';
  if (h.includes('how long') || h.includes('ending')) return 'time-outline';
  if (h.includes('rights') || h.includes('who can use')) return 'person-circle-outline';
  if (h.includes('security')) return 'lock-closed-outline';
  if (h.includes('advance') || h.includes('fee') || h.includes('wallet')) return 'wallet-outline';
  if (h.includes('cash')) return 'cash-outline';
  if (h.includes('refund') || h.includes('cancellation')) return 'shield-checkmark-outline';
  if (h.includes('driver')) return 'car-outline';
  if (h.includes('owner') || h.includes('homestay') || h.includes('room')) return 'home-outline';
  if (h.includes('dispute') || h.includes('fair use') || h.includes('liability')) return 'alert-circle-outline';
  if (h.includes('law')) return 'ribbon-outline';
  return 'document-text-outline';
}

export const LegalScreen: React.FC<{ doc?: LegalDoc; onClose?: () => void }> = (props) => {
  const navigation = useNavigation<any>();
  const routeDoc = (useRoute<RouteProp<{ p: { doc?: LegalDoc } }, 'p'>>().params as { doc?: LegalDoc } | undefined)?.doc;
  const initialDoc: LegalDoc = props.doc || routeDoc || 'privacy';

  const [activeDoc, setActiveDoc] = useState<LegalDoc>(initialDoc);
  const fallback = getFallbackLegalDoc(activeDoc);
  const [page, setPage] = useState<LegalPage | null>(fallback);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const initialFallback = getFallbackLegalDoc(activeDoc);
    setError('');

    api
      .get(`/public/legal/${activeDoc}`)
      .then((p: LegalPage) => {
        if (!cancelled && p && Array.isArray(p.sections)) {
          setPage(p);
          setError('');
        }
      })
      .catch((e: any) => {
        if (!cancelled && !initialFallback) setError(e?.message || 'Could not load this page.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeDoc, attempt]);

  const config = DOC_CONFIG[activeDoc];

  const renderBodyContent = (bodyText: string) => {
    const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
    return lines.map((line, idx) => {
      const isBullet = line.trim().startsWith('•');
      const cleanLine = isBullet ? line.replace(/^•\s*/, '').trim() : line.trim();

      if (isBullet) {
        return (
          <View key={idx} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{cleanLine}</Text>
          </View>
        );
      }

      // Check if line contains contact email / support
      const isSupportLine = cleanLine.includes('support@staycabs.in');

      return (
        <View key={idx} style={styles.paragraphContainer}>
          <Text style={styles.bodyParagraph}>{cleanLine}</Text>
          {isSupportLine && (
            <TouchableOpacity
              style={styles.contactEmailBadge}
              onPress={() => Linking.openURL('mailto:support@staycabs.in')}
            >
              <Ionicons name="mail" size={14} color={Colors.brandPrimary} />
              <Text style={styles.contactEmailText}>Email support@staycabs.in</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <Header title={page?.title || config.label} onBack={props.onClose || (() => navigation.goBack())} />

      {/* Top Segmented Document Switcher */}
      <View style={styles.segmentedRow}>
        {(['privacy', 'terms', 'refunds'] as LegalDoc[]).map((tab) => {
          const active = activeDoc === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => {
                setActiveDoc(tab);
                setPage(getFallbackLegalDoc(tab));
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={DOC_CONFIG[tab].icon}
                size={14}
                color={active ? Colors.white : '#5A556B'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab === 'privacy' ? 'Privacy' : tab === 'terms' ? 'Terms' : 'Refunds'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!page && !error ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brandPrimary} />
      ) : error && !page ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.textSecondary} />
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Highlights Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconBox}>
                <Ionicons name={config.icon} size={22} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{page!.title}</Text>
                <Text style={styles.heroTagline}>{config.tagline}</Text>
              </View>
            </View>

            <View style={styles.highlightsGrid}>
              {config.highlights.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Ionicons name={h.icon} size={15} color={Colors.brandAccent} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>{h.title}</Text>
                    <Text style={styles.highlightDesc}>{h.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.versionBadgeRow}>
              <Ionicons name="shield-checkmark" size={13} color="#DDD6FE" />
              <Text style={styles.versionText}>StayCabs Official Policy · Version {page!.version}</Text>
            </View>
          </View>

          {/* Section Cards */}
          {page!.sections.map((s, idx) => (
            <View key={idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <Ionicons name={getSectionIcon(s.heading)} size={16} color={Colors.brandPrimary} />
                </View>
                <Text style={styles.heading} accessibilityRole="header">
                  {s.heading}
                </Text>
              </View>

              <View style={styles.cardBody}>{renderBodyContent(s.body)}</View>
            </View>
          ))}

          {/* Bottom Help & Contact Card */}
          <View style={styles.helpCard}>
            <Ionicons name="chatbubble-ellipses" size={24} color={Colors.brandPrimary} />
            <Text style={styles.helpTitle}>Questions about our policies?</Text>
            <Text style={styles.helpSubtitle}>
              Our mountain support team in Darjeeling & Jalpaiguri is here to assist you anytime.
            </Text>
            <TouchableOpacity
              style={styles.helpBtn}
              onPress={() => Linking.openURL('mailto:support@staycabs.in?subject=Policy Enquiry')}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.helpBtnText}>Contact Support Desk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  segmentedRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: Colors.brandPrimary,
    ...Shadows.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A556B',
  },
  segmentTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  content: { padding: 16, paddingBottom: 50 },

  // Hero Card
  heroCard: {
    backgroundColor: Colors.brandPrimaryDark,
    borderRadius: Radii.card,
    padding: 18,
    marginBottom: 14,
    ...Shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
  heroTagline: {
    fontSize: 12,
    color: '#DDD6FE',
    marginTop: 2,
    lineHeight: 16,
  },
  highlightsGrid: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  highlightDesc: {
    fontSize: 11,
    color: '#C4B5FD',
    marginTop: 1,
    lineHeight: 15,
  },
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  versionText: {
    fontSize: 11,
    color: '#C4B5FD',
    fontWeight: '500',
  },

  // Section Cards
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8FF',
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.brandPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
  },
  cardBody: {
    gap: 8,
  },
  paragraphContainer: {
    marginBottom: 4,
  },
  bodyParagraph: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FAF9FD',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brandPrimary,
    marginBottom: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brandPrimary,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  contactEmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  contactEmailText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandPrimary,
  },

  // Help Footer Card
  helpCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 20,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    ...Shadows.card,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  helpSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
    maxWidth: 280,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    ...Shadows.sm,
  },
  helpBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },

  // State Views
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retry: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radii.button,
    backgroundColor: Colors.brandPrimary,
  },
  retryText: { color: Colors.white, fontWeight: '700' },
});
