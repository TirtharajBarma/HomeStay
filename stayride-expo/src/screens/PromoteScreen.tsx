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
  Alert,
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
  string,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; step: number }
> = {
  NEW: { label: 'New Request', color: '#0284C7', bg: '#E0F2FE', icon: 'sparkles-outline', step: 1 },
  PENDING: { label: 'Under Review', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline', step: 1 },
  CONTACTED: { label: 'Contacted', color: '#0284C7', bg: '#E0F2FE', icon: 'chatbubbles-outline', step: 2 },
  'FINDING INFLUENCERS': { label: 'Finding Influencers', color: '#7C3AED', bg: '#EDE9FE', icon: 'search-outline', step: 2 },
  IN_NEGOTIATION: { label: 'In Negotiation', color: '#7C3AED', bg: '#EDE9FE', icon: 'swap-horizontal-outline', step: 3 },
  'PROPOSAL SENT': { label: 'Proposal Sent', color: '#8B5CF6', bg: '#F3E8FF', icon: 'mail-outline', step: 3 },
  CONFIRMED: { label: 'Shoot Confirmed', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle-outline', step: 4 },
  COMPLETED: { label: 'Campaign Completed', color: '#2563EB', bg: '#DBEAFE', icon: 'videocam-outline', step: 5 },
  REJECTED: { label: 'Declined', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline', step: 0 },
  CANCELLED: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline', step: 0 },
};

export const PromoteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { homestay, session } = useStayRide();

  const [activeTab, setActiveTab] = useState<'explore' | 'collaborations'>('explore');
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loadingInfluencers, setLoadingInfluencers] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Section B: Quote Your Budget Form State
  const [budget, setBudget] = useState('');
  const [preferredDestination, setPreferredDestination] = useState(homestay?.location || '');
  const [promotionRequirements, setPromotionRequirements] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [submittingBudget, setSubmittingBudget] = useState(false);

  const [myRequests, setMyRequests] = useState<CollaborationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sync default destination from homestay if changed
  useEffect(() => {
    if (homestay?.location && !preferredDestination) {
      setPreferredDestination(homestay.location);
    }
  }, [homestay?.location]);

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

  // Submit Section B: Quote Your Budget request
  const handleSubmitBudgetRequest = async () => {
    const rawBudget = budget.replace(/\D/g, '');
    const numBudget = Number(rawBudget);

    if (!rawBudget || isNaN(numBudget) || numBudget <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid promotion budget in INR greater than zero.');
      return;
    }

    try {
      setSubmittingBudget(true);

      const payload = {
        requestType: 'BUDGET_BASED_PROMOTION',
        budget: numBudget,
        preferredDestination: preferredDestination.trim() || homestay?.location || '',
        promotionRequirements: promotionRequirements.trim(),
        additionalMessage: additionalMessage.trim(),
        homestayName: homestay?.name || 'My Homestay',
        homestayLocation: homestay?.location || '',
        ownerName: homestay?.ownerName || session?.owner?.name || 'Homestay Owner',
        ownerPhone: homestay?.phone || session?.owner?.phone || '',
        ownerEmail: homestay?.email || session?.owner?.email || '',
      };

      await api.post('/collaboration-requests', payload);

      Alert.alert(
        'Request Submitted! 🎉',
        'Your promotion request has been submitted! Our StayCabs team will find suitable influencers within your budget and contact you.',
        [
          {
            text: 'Track Request',
            onPress: () => {
              setActiveTab('collaborations');
              fetchMyRequests();
            },
          },
        ]
      );

      setBudget('');
      setPromotionRequirements('');
      setAdditionalMessage('');
      fetchMyRequests();
    } catch (err: any) {
      Alert.alert('Submission Error', err?.message || 'Could not submit your promotion request. Please try again.');
    } finally {
      setSubmittingBudget(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Promote Homestay" />

      {/* Main Mode Toggle: Explore vs My Requests */}
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
            Explore & Quote
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

            {/* ========================================================================= */}
            {/* SECTION B: Request Influencer Recommendations (Quote Your Budget) */}
            {/* ========================================================================= */}
            <View style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <View style={styles.budgetIconCircle}>
                  <Ionicons name="megaphone" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetTitle}>Quote Your Budget</Text>
                  <Text style={styles.budgetSubtitle}>
                    Have a budget in mind? Tell us how much you want to spend on promotion, and our StayCabs team will find suitable influencers for your homestay.
                  </Text>
                </View>
              </View>

              {/* Field 1: Promotion Budget (Required) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Promotion Budget (₹) <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <View style={styles.budgetInputWrap}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.budgetInput}
                    placeholder="e.g. 8000"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="numeric"
                    value={budget}
                    onChangeText={setBudget}
                  />
                </View>
              </View>

              {/* Field 2: Preferred Destination (Optional) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Preferred Destination (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Darjeeling, Kalimpong, Gangtok"
                  placeholderTextColor={Colors.textSecondary}
                  value={preferredDestination}
                  onChangeText={setPreferredDestination}
                />
              </View>

              {/* Field 3: Promotion Requirements (Optional) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Promotion Requirements (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Instagram Reel, Stories, Travel Vlog, Drone b-roll"
                  placeholderTextColor={Colors.textSecondary}
                  value={promotionRequirements}
                  onChangeText={setPromotionRequirements}
                />
              </View>

              {/* Field 4: Additional Message (Optional) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Additional Message (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Describe your homestay's unique highlights, views, rooms, or any specific creator profile you prefer..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={additionalMessage}
                  onChangeText={setAdditionalMessage}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.budgetSubmitBtn, submittingBudget && { opacity: 0.65 }]}
                onPress={handleSubmitBudgetRequest}
                disabled={submittingBudget}
                activeOpacity={0.8}
              >
                {submittingBudget ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.budgetSubmitBtnText}>Submit Request</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* SECTION A: Discover Influencers */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Discover Mountain Creators</Text>
                <Text style={styles.sectionSubtitle}>
                  Browse certified creators added by StayCabs admin
                </Text>
              </View>
            </View>

            {/* Destination Filters */}
            <View style={styles.filterSection}>
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
          /* MY REQUESTS TRACKING TAB */
          /* ========================================================================= */
          <>
            <View style={styles.myRequestsHeader}>
              <Text style={styles.myRequestsTitle}>Your Promotion Requests</Text>
              <Text style={styles.myRequestsDesc}>
                Track live review, influencer matching, and shooting schedules coordinated by the StayCabs team.
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
                <Text style={styles.emptyTitle}>No promotion requests yet</Text>
                <Text style={styles.emptyDesc}>
                  Quote your budget above or invite a mountain creator from the Explore tab to begin.
                </Text>
                <TouchableOpacity
                  style={[styles.collabBtn, { marginTop: 14, paddingHorizontal: 20 }]}
                  onPress={() => setActiveTab('explore')}
                >
                  <Text style={styles.collabBtnText}>Start Promoting</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.requestsList}>
                {myRequests.map((req) => {
                  const statusInfo = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                  const isBudgetRequest = req.requestType === 'BUDGET_BASED_PROMOTION';
                  const reqIdText = req.requestId || `REQ-${req._id.slice(-6).toUpperCase()}`;

                  return (
                    <View key={req._id} style={styles.requestCard}>
                      {/* Top Row: Request ID + Category Badge + Status Badge */}
                      <View style={styles.requestTop}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.requestIdBadge}>{reqIdText}</Text>
                            <View
                              style={[
                                styles.categoryTag,
                                isBudgetRequest ? styles.categoryTagBudget : styles.categoryTagDirect,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryTagText,
                                  isBudgetRequest ? styles.categoryTagTextBudget : styles.categoryTagTextDirect,
                                ]}
                              >
                                {isBudgetRequest ? 'Budget-Based Promotion' : 'Creator Invite'}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.requestInfluencerName}>
                            {isBudgetRequest
                              ? `Budget: ₹${req.budget?.toLocaleString()}`
                              : req.influencerName || 'Mountain Creator'}
                          </Text>
                          {!isBudgetRequest && req.influencerHandle && (
                            <Text style={styles.requestHandle}>{req.influencerHandle}</Text>
                          )}
                        </View>

                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                          <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>

                      {/* Request Details Grid */}
                      <View style={styles.requestDetailsGrid}>
                        {isBudgetRequest ? (
                          <>
                            <View style={styles.detailItem}>
                              <Text style={styles.detailItemLabel}>Quoted Budget</Text>
                              <Text style={styles.detailItemPrice}>
                                ₹{req.budget?.toLocaleString() || '0'}
                              </Text>
                            </View>
                            <View style={styles.detailItem}>
                              <Text style={styles.detailItemLabel}>Region</Text>
                              <Text style={styles.detailItemVal}>
                                {req.preferredDestination || 'All Hill Regions'}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </View>

                      {/* Assigned Influencer & Agreed Price Row (if recorded by admin) */}
                      {(req.assignedInfluencerName || req.agreedPrice) && (
                        <View style={styles.assignedBox}>
                          {req.assignedInfluencerName ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="person-circle-outline" size={14} color="#16A34A" />
                              <Text style={styles.assignedText}>
                                Assigned Creator: <Text style={{ fontWeight: '700' }}>{req.assignedInfluencerName}</Text>
                              </Text>
                            </View>
                          ) : null}
                          {req.agreedPrice ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="pricetag-outline" size={13} color="#16A34A" />
                              <Text style={styles.assignedText}>
                                Agreed Price: <Text style={{ fontWeight: '700' }}>₹{req.agreedPrice.toLocaleString()}</Text>
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {/* Requirements / Notes if provided */}
                      {(req.promotionRequirements || req.additionalMessage || req.customRequirements) && (
                        <View style={styles.messageBox}>
                          <Text style={styles.messageBoxLabel}>Requirements:</Text>
                          <Text style={styles.messageBoxText}>
                            {req.promotionRequirements || req.additionalMessage || req.customRequirements}
                          </Text>
                        </View>
                      )}

                      {/* Progress Stepper (1 to 5) */}
                      {req.status !== 'CANCELLED' && req.status !== 'REJECTED' && (
                        <View style={styles.stepperContainer}>
                          <View style={styles.stepperRow}>
                            {['Submitted', 'Contacted', 'Finding', 'Proposal', 'Completed'].map((stepName, sIdx) => {
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
    backgroundColor: Colors.bgPage,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingHorizontal: 16,
    paddingTop: 4,
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
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E1435',
    borderRadius: Radii.lg,
    padding: 18,
    marginBottom: 16,
    ...Shadows.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    color: '#DDD6FE',
    lineHeight: 18,
  },
  // Section B: Quote Your Budget Card
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    ...Shadows.sm,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  budgetIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  budgetSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  budgetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radii.button,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
    marginRight: 6,
  },
  budgetInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radii.button,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  budgetSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: Radii.button,
    marginTop: 4,
    ...Shadows.sm,
  },
  budgetSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  // Section A Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  filterSection: {
    marginBottom: 10,
  },
  filterList: {
    paddingVertical: 4,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
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
    color: Colors.textSecondary,
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
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  creatorList: {
    gap: 12,
  },
  creatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    ...Shadows.sm,
  },
  creatorTop: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brandPrimaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.brandPrimaryDark,
  },
  verifiedIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  creatorInfo: {
    flex: 1,
    minWidth: 0,
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
  },
  featuredBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
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
    lineHeight: 15,
    marginTop: 3,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  statBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  destinationTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  destinationTagsText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  creatorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  profileBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radii.button,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  collabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radii.button,
    backgroundColor: Colors.brandPrimary,
  },
  collabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // My Requests Tab
  myRequestsHeader: {
    marginBottom: 14,
  },
  myRequestsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  myRequestsDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  requestsList: {
    gap: 12,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    ...Shadows.sm,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  requestIdBadge: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagBudget: {
    backgroundColor: '#FEF3C7',
  },
  categoryTagDirect: {
    backgroundColor: '#E0E7FF',
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  categoryTagTextBudget: {
    color: '#B45309',
  },
  categoryTagTextDirect: {
    color: '#4338CA',
  },
  requestInfluencerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
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
    marginBottom: 8,
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
    fontSize: 13,
    fontWeight: '800',
    color: Colors.brandPrimary,
    marginTop: 2,
  },
  assignedBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: Radii.sm,
    padding: 8,
    marginBottom: 8,
    gap: 4,
  },
  assignedText: {
    fontSize: 11,
    color: '#166534',
  },
  messageBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.sm,
    padding: 8,
    marginBottom: 8,
  },
  messageBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  messageBoxText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  stepperContainer: {
    marginVertical: 6,
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
    marginTop: 6,
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
    marginTop: 6,
  },
  postLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BE185D',
  },
  requestFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
    paddingTop: 6,
  },
  requestFooterDate: {
    fontSize: 10,
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
    padding: 36,
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
