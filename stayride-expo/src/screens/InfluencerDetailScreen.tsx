import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Header } from '../components/Header';
import { api } from '../data/api';
import { Influencer, InfluencerPackage } from '../types';

export const InfluencerDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { influencerId } = route.params || {};

  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<InfluencerPackage | null>(null);

  useEffect(() => {
    async function loadDetails() {
      if (!influencerId) return;
      try {
        setLoading(true);
        const res = await api.get(`/influencers/${influencerId}`);
        const data = (res as any)?.data || res;
        setInfluencer(data);
        if (data?.packages?.length) {
          setSelectedPackage(data.packages[0]);
        }
      } catch (err) {
        console.warn('Failed to load influencer:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [influencerId]);

  const openInstagram = () => {
    if (!influencer) return;
    const url =
      influencer.instagramUrl ||
      `https://instagram.com/${influencer.instagramHandle.replace('@', '')}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleInvite = (pkg?: InfluencerPackage) => {
    if (!influencer) return;
    navigation.navigate('CollaborateRequest', {
      influencerId: influencer._id,
      influencerName: influencer.name,
      influencerHandle: influencer.instagramHandle,
      selectedPackage: pkg || selectedPackage || influencer.packages?.[0],
      packages: influencer.packages,
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Creator Profile" />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.brandPrimary} />
          <Text style={styles.loadingText}>Loading creator profile...</Text>
        </View>
      </View>
    );
  }

  if (!influencer) {
    return (
      <View style={styles.container}>
        <Header title="Creator Profile" />
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.notFoundText}>Influencer profile not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={influencer.name} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Creator Cover / Header Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            {influencer.profilePhoto ? (
              <Image source={{ uri: influencer.profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {influencer.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.headerInfo}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.nameText}>{influencer.name}</Text>
                {influencer.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" />
                )}
              </View>
              <Text style={styles.handleText}>{influencer.instagramHandle}</Text>

              <TouchableOpacity style={styles.instagramBtn} onPress={openInstagram} activeOpacity={0.8}>
                <Ionicons name="logo-instagram" size={14} color="#E1306C" style={{ marginRight: 4 }} />
                <Text style={styles.instagramBtnText}>Open Instagram</Text>
                <Ionicons name="open-outline" size={12} color="#64748B" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsStrip}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Followers</Text>
              <Text style={styles.statVal}>
                {influencer.followersCount >= 1000
                  ? `${(influencer.followersCount / 1000).toFixed(
                      influencer.followersCount >= 100000 ? 0 : 1
                    )}K`
                  : influencer.followersCount}
              </Text>
            </View>

            <View style={styles.statSep} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Avg Views</Text>
              <Text style={[styles.statVal, { color: '#16A34A' }]}>
                {influencer.averageViews >= 1000
                  ? `${(influencer.averageViews / 1000).toFixed(
                      influencer.averageViews >= 100000 ? 0 : 1
                    )}K`
                  : influencer.averageViews || '—'}
              </Text>
            </View>

            <View style={styles.statSep} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Starts at</Text>
              <Text style={[styles.statVal, { color: Colors.brandPrimary }]}>
                ₹{influencer.startingPrice?.toLocaleString() || '5,000'}
              </Text>
            </View>
          </View>

          {/* Tagline & Bio */}
          {influencer.tagline ? (
            <Text style={styles.tagline}>{influencer.tagline}</Text>
          ) : null}

          {influencer.bio ? (
            <Text style={styles.bio}>{influencer.bio}</Text>
          ) : null}

          {/* Covered Destinations */}
          <View style={styles.destSection}>
            <Text style={styles.sectionSubtitle}>DESTINATIONS COVERED:</Text>
            <View style={styles.destPills}>
              {influencer.destinations?.map((dest) => (
                <View key={dest} style={styles.destPill}>
                  <Ionicons name="location-sharp" size={10} color={Colors.brandPrimary} style={{ marginRight: 3 }} />
                  <Text style={styles.destPillText}>{dest}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Promotion Packages Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Promotion Packages</Text>
          <Text style={styles.sectionDesc}>
            Choose a curated promotion format tailored for hill homestays:
          </Text>
        </View>

        <View style={styles.packagesList}>
          {influencer.packages?.map((pkg, idx) => {
            const isChosen = selectedPackage?.name === pkg.name;

            return (
              <TouchableOpacity
                key={idx}
                style={[styles.packageCard, isChosen && styles.packageCardSelected]}
                onPress={() => setSelectedPackage(pkg)}
                activeOpacity={0.8}
              >
                <View style={styles.packageHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    {pkg.turnaroundDays ? (
                      <Text style={styles.turnaroundText}>
                        Est. delivery: within {pkg.turnaroundDays} days of shoot
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.packagePrice}>₹{pkg.price.toLocaleString()}</Text>
                </View>

                <Text style={styles.deliverablesText}>{pkg.deliverables}</Text>

                <TouchableOpacity
                  style={[styles.selectPackageBtn, isChosen && styles.selectPackageBtnChosen]}
                  onPress={() => handleInvite(pkg)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectPackageBtnText, isChosen && styles.selectPackageBtnTextChosen]}>
                    Select & Invite for ₹{pkg.price.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sample Reels / Posts Links */}
        {influencer.sampleReels?.length > 0 && (
          <View style={styles.sampleSection}>
            <Text style={styles.sectionTitle}>Sample Work & Past Reels</Text>
            <View style={styles.sampleList}>
              {influencer.sampleReels.map((reel, rIdx) => (
                <TouchableOpacity
                  key={rIdx}
                  style={styles.sampleItem}
                  onPress={() => Linking.openURL(reel.url).catch(() => {})}
                >
                  <Ionicons name="play-circle" size={24} color="#E1306C" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sampleTitle}>{reel.title || 'Watch Sample Homestay Reel'}</Text>
                    <Text style={styles.sampleUrl} numberOfLines={1}>{reel.url}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarLabel}>Starts from</Text>
          <Text style={styles.bottomBarPrice}>
            ₹{selectedPackage?.price ? selectedPackage.price.toLocaleString() : influencer.startingPrice.toLocaleString()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bottomBarBtn}
          onPress={() => handleInvite()}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.bottomBarBtnText}>Invite to Collaborate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  notFoundText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    ...Shadows.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDE9FE',
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  handleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandPrimary,
    marginTop: 1,
  },
  instagramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FDF2F8',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  instagramBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE185D',
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statSep: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 19,
    marginBottom: 8,
  },
  bio: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  destSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  destPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  destPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  destPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brandPrimary,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  packagesList: {
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...Shadows.sm,
  },
  packageCardSelected: {
    borderColor: Colors.brandPrimary,
    backgroundColor: '#FAF5FF',
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  turnaroundText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '500',
    marginTop: 2,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.brandPrimary,
  },
  deliverablesText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  selectPackageBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: Radii.md,
    paddingVertical: 9,
    alignItems: 'center',
  },
  selectPackageBtnChosen: {
    backgroundColor: Colors.brandPrimary,
  },
  selectPackageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  selectPackageBtnTextChosen: {
    color: '#FFFFFF',
  },
  sampleSection: {
    marginBottom: 20,
  },
  sampleList: {
    marginTop: 10,
    gap: 8,
  },
  sampleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  sampleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  sampleUrl: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Shadows.md,
  },
  bottomBarInfo: {
    flex: 1,
  },
  bottomBarLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  bottomBarPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.brandPrimary,
  },
  bottomBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.md,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  bottomBarBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
