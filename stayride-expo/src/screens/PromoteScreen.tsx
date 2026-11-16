import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Header } from '../components/Header';
import { api } from '../data/api';
import { useStayRide } from '../data/store';
import { Influencer, CollaborationRequest, CollaborationStatus } from '../types';

const DESTINATIONS = ['All', 'Darjeeling', 'Kalimpong', 'Kurseong', 'Gangtok', 'Sikkim'];

const STATUS_CONFIG: Record<
  CollaborationStatus,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; step: number }
> = {
  PENDING: { label: 'Under Review', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline', step: 1 },
  CONTACTED: { label: 'Contacted', color: '#0284C7', bg: '#E0F2FE', icon: 'chatbubbles-outline', step: 2 },
  IN_NEGOTIATION: { label: 'In Negotiation', color: '#7C3AED', bg: '#EDE9FE', icon: 'swap-horizontal-outline', step: 3 },
  CONFIRMED: { label: 'Shoot Confirmed', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle-outline', step: 4 },
  COMPLETED: { label: 'Campaign Completed', color: '#2563EB', bg: '#DBEAFE', icon: 'videocam-outline', step: 5 },
  CANCELLED: { label: 'Declined / Cancelled', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline', step: 0 },
};

export const PromoteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { homestay } = useStayRide();

  const [activeTab, setActiveTab] = useState<'explore' | 'collaborations'>('explore');
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loadingInfluencers, setLoadingInfluencers] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [myRequests, setMyRequests] = useState<CollaborationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch influencers from backend
  const fetchInfluencers = async () => {
    try {
      setLoadingInfluencers(true);
      const params = new URLSearchParams();
      if (selectedDestination !== 'All') params.set('destination', selectedDestination);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await api.get(`/influencers${params.toString() ? `?${params.toString()}` : ''}`);
      if (res && Array.isArray((res as any).data)) {
        setInfluencers((res as any).data);
      } else if (Array.isArray(res)) {
        setInfluencers(res);
      }
    } catch (err) {
      console.warn('Failed to load influencers:', err);
    } finally {
      setLoadingInfluencers(false);
    }
  };

  // Fetch owner's collaboration requests
  const fetchMyRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.get('/collaboration-requests/my');
      if (res && Array.isArray((res as any).data)) {
        setMyRequests((res as any).data);
      } else if (Array.isArray(res)) {
        setMyRequests(res);
      }
    } catch (err) {
      console.warn('Failed to load collaboration requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchInfluencers();
  }, [selectedDestination]);

  useFocusEffect(
    useCallback(() => {
      fetchMyRequests();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchInfluencers(), fetchMyRequests()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header title="Promote Homestay" />

      {/* Main Mode Toggle: Explore vs My Collaborations */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'explore' && styles.tabButtonActive]}
          onPress={() => setActiveTab('explore')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="compass-outline"
            size={16}
            color={activeTab === 'explore' ? Colors.brandPrimary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>
            Explore Creators
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'collaborations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('collaborations')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="paper-plane-outline"
            size={16}
            color={activeTab === 'collaborations' ? Colors.brandPrimary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'collaborations' && styles.tabTextActive]}>
            My Requests {myRequests.length > 0 ? `(${myRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brandPrimary]} />
        }
      >
        {activeTab === 'explore' ? (
          <>
            {/* Promo Banner Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={12} color="#F59E0B" />
                <Text style={styles.heroBadgeText}>STAYCABS PROMOTE</Text>
              </View>
              <Text style={styles.heroTitle}>Partner with Top Mountain Creators</Text>
              <Text style={styles.heroDesc}>
                Boost your bookings by inviting certified hill travel influencers in Darjeeling, Sikkim,
                Kalimpong and Kurseong to feature your property on Instagram & YouTube.
              </Text>
            </View>

            {/* Destination Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Discover by Region:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
                {DESTINATIONS.map((dest) => {
                  const isSelected = selectedDestination === dest;
                  return (
                    <TouchableOpacity
                      key={dest}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setSelectedDestination(dest)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {dest}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search creator name, @handle, style..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={fetchInfluencers}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setTimeout(fetchInfluencers, 50);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Influencers Listing */}
            {loadingInfluencers ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.brandPrimary} />
                <Text style={styles.loadingText}>Loading mountain creators...</Text>
              </View>
            ) : influencers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="camera-outline" size={48} color={Colors.divider} />
                <Text style={styles.emptyTitle}>No creators found</Text>
                <Text style={styles.emptyDesc}>
                  Try selecting a different hill region or clearing your search.
                </Text>
              </View>
            ) : (
              <View style={styles.creatorList}>
                {influencers.map((creator) => (
                  <View key={creator._id} style={styles.creatorCard}>
                    {/* Top Row: Avatar + Name + Verified */}
                    <View style={styles.creatorTop}>
                      <View style={styles.avatarWrap}>
                        {creator.profilePhoto ? (
                          <Image source={{ uri: creator.profilePhoto }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarFallbackText}>
                              {creator.name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {creator.isVerified && (
                          <View style={styles.verifiedIcon}>
                            <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <View style={styles.creatorInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.creatorName} numberOfLines={1}>
                            {creator.name}
                          </Text>
                          {creator.isFeatured && (
                            <View style={styles.featuredBadge}>
                              <Text style={styles.featuredBadgeText}>FEATURED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.creatorHandle}>{creator.instagramHandle}</Text>
                        <Text style={styles.creatorTagline} numberOfLines={2}>
                          {creator.tagline || 'Himalayan travel and homestay creator'}
                        </Text>
                      </View>
                    </View>

                    {/* Stats Metric Strip */}
                    <View style={styles.statsStrip}>
                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Followers</Text>
                        <Text style={styles.statBoxValue}>
                          {creator.followersCount >= 1000
                            ? `${(creator.followersCount / 1000).toFixed(
                                creator.followersCount >= 100000 ? 0 : 1
                              )}K`
                            : creator.followersCount}
                        </Text>
                      </View>

                      <View style={styles.statDivider} />

                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Avg Views</Text>
                        <Text style={[styles.statBoxValue, { color: '#16A34A' }]}>
                          {creator.averageViews >= 1000
                            ? `${(creator.averageViews / 1000).toFixed(
                                creator.averageViews >= 100000 ? 0 : 1
                              )}K`
                            : creator.averageViews || '—'}
                        </Text>
                      </View>

                      <View style={styles.statDivider} />

                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Starting at</Text>
                        <Text style={[styles.statBoxValue, { color: Colors.brandPrimary }]}>
                          ₹{creator.startingPrice?.toLocaleString() || '5,000'}
                        </Text>
                      </View>
                    </View>

                    {/* Destination Chips */}
                    <View style={styles.destinationTags}>
                      <Ionicons name="location-outline" size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={styles.destinationTagsText}>
                        {creator.destinations?.join(' • ') || 'Darjeeling'}
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.creatorActions}>
                      <TouchableOpacity
                        style={styles.profileBtn}
                        onPress={() => navigation.navigate('InfluencerDetail', { influencerId: creator._id })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.profileBtnText}>View Profile & Packages</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.collabBtn}
                        onPress={() =>
                          navigation.navigate('CollaborateRequest', {
                            influencerId: creator._id,
                            influencerName: creator.name,
                            influencerHandle: creator.instagramHandle,
                            packages: creator.packages,
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <Ionicons name="paper-plane" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.collabBtnText}>Invite</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          /* ========================================================================= */
          /* TAB 2: MY COLLABORATIONS & STATUS TRACKING                                */
          /* ========================================================================= */
          <>
            <View style={styles.myCollabHeader}>
              <Text style={styles.sectionHeaderTitle}>Collaboration History</Text>
              <Text style={styles.sectionHeaderDesc}>
                Track real-time status of creator invites, shoot schedules, and published posts for{' '}
                {homestay?.name || 'your homestay'}.
              </Text>
            </View>

            {loadingRequests ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.brandPrimary} />
                <Text style={styles.loadingText}>Fetching your requests...</Text>
              </View>
            ) : myRequests.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.divider} />
                <Text style={styles.emptyTitle}>No collaboration invites yet</Text>
                <Text style={styles.emptyDesc}>
                  Select a mountain creator from the Explore tab and click &quot;Invite to Collaborate&quot; to begin.
                </Text>
                <TouchableOpacity
                  style={[styles.collabBtn, { marginTop: 14, paddingHorizontal: 20 }]}
                  onPress={() => setActiveTab('explore')}
                >
                  <Text style={styles.collabBtnText}>Browse Creators</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.requestsList}>
                {myRequests.map((req) => {
                  const statusInfo = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;

                  return (
                    <View key={req._id} style={styles.requestCard}>
                      {/* Top Row: Influencer Name + Status Badge */}
                      <View style={styles.requestTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requestInfluencerName}>{req.influencerName}</Text>
                          <Text style={styles.requestHandle}>{req.influencerHandle}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                          <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>

                      {/* Package & Proposed Dates */}
                      <View style={styles.requestDetailsGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailItemLabel}>Package</Text>
                          <Text style={styles.detailItemVal}>
                            {req.selectedPackage?.name || 'Standard Package'}
                          </Text>
                          <Text style={styles.detailItemPrice}>
                            ₹{req.selectedPackage?.price?.toLocaleString() || '5,000'}
                          </Text>
                        </View>

                        <View style={styles.detailItem}>
                          <Text style={styles.detailItemLabel}>Preferred Schedule</Text>
                          <Text style={styles.detailItemVal}>
                            {req.confirmedShootingDate ? `Locked: ${req.confirmedShootingDate}` : req.proposedDates || 'Flexible'}
                          </Text>
                        </View>
                      </View>

                      {/* Progress Stepper (1 to 5) */}
                      {req.status !== 'CANCELLED' && (
                        <View style={styles.stepperContainer}>
                          <View style={styles.stepperRow}>
                            {['Submitted', 'Contacted', 'Negotiation', 'Shoot Locked', 'Posted'].map((stepName, sIdx) => {
                              const stepNum = sIdx + 1;
                              const isPassed = statusInfo.step >= stepNum;
                              const isCurrent = statusInfo.step === stepNum;

                              return (
                                <View key={stepName} style={styles.stepItem}>
                                  <View
                                    style={[
                                      styles.stepDot,
                                      isPassed && styles.stepDotPassed,
                                      isCurrent && styles.stepDotCurrent,
                                    ]}
                                  >
                                    {isPassed ? (
                                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                    ) : (
                                      <Text style={styles.stepDotNum}>{stepNum}</Text>
                                    )}
                                  </View>
                                  <Text
                                    style={[
                                      styles.stepName,
                                      isPassed && styles.stepNamePassed,
                                      isCurrent && styles.stepNameCurrent,
                                    ]}
                                  >
                                    {stepName}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      {/* Admin Notes or Updates */}
                      {req.adminNotes && (
                        <View style={styles.adminNotesBox}>
                          <Ionicons name="information-circle" size={14} color={Colors.brandPrimary} style={{ marginRight: 6 }} />
                          <Text style={styles.adminNotesText}>
                            <Text style={{ fontWeight: '700' }}>StayCabs Update: </Text>
                            {req.adminNotes}
                          </Text>
                        </View>
                      )}

                      {/* Published Post Link if completed */}
                      {req.deliveredPostUrl && (
                        <TouchableOpacity
                          style={styles.postLinkBtn}
                          onPress={() => {
                            // Link open handled natively
                          }}
                        >
                          <Ionicons name="logo-instagram" size={14} color="#E1306C" style={{ marginRight: 6 }} />
                          <Text style={styles.postLinkText}>View Published Reel / Content</Text>
                        </TouchableOpacity>
                      )}

                      {/* Footer: Date */}
                      <View style={styles.requestFooter}>
                        <Text style={styles.requestFooterDate}>
                          Submitted on{' '}
                          {new Date(req.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabButtonActive: {
    borderBottomColor: Colors.brandPrimary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.brandPrimary,
  },
  heroCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: Radii.lg,
    padding: 18,
    marginBottom: 16,
    ...Shadows.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterList: {
    paddingRight: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  creatorList: {
    gap: 16,
  },
  creatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...Shadows.sm,
  },
  creatorTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDE9FE',
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  verifiedIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0EA5E9',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  creatorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  featuredBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  creatorHandle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandPrimary,
    marginTop: 1,
  },
  creatorTagline: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 3,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statBoxValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  destinationTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  destinationTagsText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  creatorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  profileBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radii.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  profileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  collabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  collabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  myCollabHeader: {
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeaderDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  requestsList: {
    gap: 14,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...Shadows.sm,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestInfluencerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestHandle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandPrimary,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requestDetailsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    padding: 10,
    marginBottom: 12,
    gap: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  detailItemVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  detailItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.brandPrimary,
    marginTop: 1,
  },
  stepperContainer: {
    marginVertical: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepItem: {
    alignItems: 'center',
    width: '20%',
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotPassed: {
    backgroundColor: '#16A34A',
  },
  stepDotCurrent: {
    backgroundColor: Colors.brandPrimary,
  },
  stepDotNum: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  stepName: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  stepNamePassed: {
    color: '#16A34A',
    fontWeight: '600',
  },
  stepNameCurrent: {
    color: Colors.brandPrimary,
    fontWeight: '700',
  },
  adminNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    borderRadius: Radii.sm,
    padding: 10,
    marginTop: 8,
  },
  adminNotesText: {
    flex: 1,
    fontSize: 11,
    color: '#4C1D95',
    lineHeight: 16,
  },
  postLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F8',
    borderRadius: Radii.sm,
    padding: 10,
    marginTop: 8,
  },
  postLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BE185D',
  },
  requestFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 12,
    paddingTop: 8,
  },
  requestFooterDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
