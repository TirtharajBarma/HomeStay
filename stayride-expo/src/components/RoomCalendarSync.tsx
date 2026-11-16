import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useStayRide } from '../data/store';
import { Colors, Radii } from '../theme/colors';
import { RoomCalendar } from '../types';

const MAX_LINKS = 3;

function getOtaBadge(url: string) {
  const u = url.toLowerCase();
  if (u.includes('airbnb')) return { name: 'Airbnb', color: '#FF385C', bg: '#FFE8EC', icon: 'home-outline' as const };
  if (u.includes('booking')) return { name: 'Booking.com', color: '#003580', bg: '#E6EFFC', icon: 'bed-outline' as const };
  if (u.includes('agoda')) return { name: 'Agoda', color: '#2C6ECB', bg: '#EEF5FF', icon: 'globe-outline' as const };
  if (u.includes('makemytrip')) return { name: 'MakeMyTrip', color: '#D9232D', bg: '#FDECEE', icon: 'airplane-outline' as const };
  if (u.includes('google')) return { name: 'Google Cal', color: '#1A73E8', bg: '#E8F0FE', icon: 'calendar-outline' as const };
  return { name: 'OTA Calendar', color: Colors.brandPrimary, bg: Colors.brandPrimaryLight, icon: 'link-outline' as const };
}

// Two-way calendar sync for one room with Airbnb, Booking.com and similar sites (iCal):
// give them our export link, paste their export links here.
export const RoomCalendarSync: React.FC<{ roomId: number }> = ({ roomId }) => {
  const { getRoomCalendar, setRoomCalendarLinks, syncRoomCalendar } = useStayRide();
  const [cal, setCal] = useState<RoomCalendar | null>(null);
  const [links, setLinks] = useState<string[]>(['']);
  const [busy, setBusy] = useState<'load' | 'save' | 'sync' | null>('load');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoomCalendar(roomId)
      .then((c) => {
        if (cancelled) return;
        setCal(c);
        setLinks(c.imports.length ? c.imports.map((i) => i.url) : ['']);
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not load calendar settings (needs internet).'))
      .finally(() => !cancelled && setBusy(null));
    return () => {
      cancelled = true;
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const summarize = (c: RoomCalendar) => {
    const lines = (c.results || []).map((r) =>
      r.ok
        ? `${r.source}: ${r.added} new, ${r.updated} changed, ${r.cancelled} cancelled${r.conflicts ? `, ⚠ ${r.conflicts} double booking(s)` : ''}`
        : `${r.source}: ${r.error}`
    );
    if (lines.length) Alert.alert('Calendar Sync Complete', lines.join('\n'));
  };

  const handleCopyLink = () => {
    if (!cal?.exportUrl) return;
    Clipboard.setStringAsync(cal.exportUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShareLink = () => {
    if (!cal?.exportUrl) return;
    Share.share({
      title: 'StayCabs Room Calendar Feed',
      message: cal.exportUrl,
    }).catch(() => {});
  };

  const save = async () => {
    setBusy('save');
    try {
      const c = await setRoomCalendarLinks(roomId, links.map((l) => l.trim()).filter(Boolean));
      setCal(c);
      summarize(c);
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please check the links and try again.');
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    try {
      const c = await syncRoomCalendar(roomId);
      setCal(c);
      summarize(c);
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (busy === 'load') {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={Colors.brandPrimary} />
        <Text style={styles.loadingText}>Loading calendar sync...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={18} color={Colors.statusRed} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!cal) return null;

  const hasActiveSync = cal.imports && cal.imports.length > 0;

  return (
    <View style={styles.container}>
      {/* 1. Header Card */}
      <View style={styles.headerRow}>
        <View style={styles.headerIconBadge}>
          <Ionicons name="sync" size={18} color={Colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Airbnb & Booking.com Sync</Text>
          <Text style={styles.headerSubtitle}>Prevent double-bookings across platforms</Text>
        </View>
        {hasActiveSync && (
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activePillText}>Active</Text>
          </View>
        )}
      </View>

      {/* Explainer / Guide Toggle */}
      <TouchableOpacity
        style={styles.guideToggle}
        onPress={() => setShowGuide((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={showGuide ? 'information-circle' : 'information-circle-outline'}
          size={16}
          color={Colors.brandPrimary}
        />
        <Text style={styles.guideToggleText}>
          {showGuide ? 'Hide quick setup instructions' : 'How does 2-way sync work?'}
        </Text>
        <Ionicons
          name={showGuide ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {showGuide && (
        <View style={styles.guideCard}>
          <Text style={styles.guideStep}>
            <Text style={styles.boldText}>Step 1 (Export): </Text>
            Copy the StayCabs link below and paste into Airbnb (*Listings → Pricing & Availability → Sync Calendars → Import*). Airbnb will automatically block dates booked here.
          </Text>
          <Text style={[styles.guideStep, { marginTop: 6 }]}>
            <Text style={styles.boldText}>Step 2 (Import): </Text>
            Copy the export link from your Airbnb or Booking.com room and paste it in Step 2 below. Their bookings will automatically block dates here.
          </Text>
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 1: EXPORT (StayCabs -> Airbnb/Booking) */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.cardSection}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>1</Text>
          </View>
          <Text style={styles.sectionTitle}>Export to Airbnb / Booking.com</Text>
        </View>
        <Text style={styles.sectionCaption}>
          Give this link to other sites so they block dates booked on StayCabs:
        </Text>

        {/* Clean URL preview container */}
        <View style={styles.urlBox}>
          <Ionicons name="link-outline" size={16} color={Colors.brandPrimary} style={{ marginRight: 6 }} />
          <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
            {cal.exportUrl}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionBtn, copied && styles.actionBtnCopied]}
            onPress={handleCopyLink}
            activeOpacity={0.8}
          >
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={15}
              color={copied ? Colors.statusGreen : Colors.brandPrimary}
            />
            <Text style={[styles.actionBtnText, copied && { color: Colors.statusGreen }]}>
              {copied ? 'Copied to Clipboard!' : 'Copy Calendar Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShareLink} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* STEP 2: IMPORT (Airbnb/Booking -> StayCabs) */}
      {/* ------------------------------------------------------------- */}
      <View style={[styles.cardSection, { marginTop: 12 }]}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.stepBadge, { backgroundColor: Colors.brandAccent }]}>
            <Text style={styles.stepBadgeText}>2</Text>
          </View>
          <Text style={styles.sectionTitle}>Import from External Sites</Text>
        </View>
        <Text style={styles.sectionCaption}>
          Paste each site&apos;s calendar link (iCal) to automatically block dates here:
        </Text>

        {links.map((l, i) => {
          const trimmed = l.trim();
          const badge = trimmed ? getOtaBadge(trimmed) : null;
          const imp = cal.imports.find((x) => x.url === trimmed);

          return (
            <View key={i} style={styles.inputWrapper}>
              {badge && (
                <View style={[styles.otaBadge, { backgroundColor: badge.bg }]}>
                  <Ionicons name={badge.icon} size={12} color={badge.color} />
                  <Text style={[styles.otaBadgeText, { color: badge.color }]}>{badge.name}</Text>
                </View>
              )}

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={l}
                  onChangeText={(t) => setLinks((prev) => prev.map((x, j) => (j === i ? t : x)))}
                />
                {links.length > 1 && (
                  <TouchableOpacity
                    style={styles.deleteLinkBtn}
                    onPress={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {imp && (
                <View style={styles.syncStatusRow}>
                  <Ionicons
                    name={imp.lastError ? 'alert-circle' : 'checkmark-circle'}
                    size={13}
                    color={imp.lastError ? Colors.statusRed : Colors.statusGreen}
                  />
                  <Text
                    style={[
                      styles.syncStatusText,
                      imp.lastError && { color: Colors.statusRed },
                    ]}
                  >
                    {imp.source} ·{' '}
                    {imp.lastError
                      ? imp.lastError
                      : imp.lastSyncAt
                      ? `Synced ${new Date(imp.lastSyncAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata',
                        })} • ${imp.eventCount} booking(s)`
                      : 'Pending first sync'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {links.length < MAX_LINKS && (
          <TouchableOpacity
            style={styles.addSiteBtn}
            onPress={() => setLinks((p) => [...p, ''])}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.brandPrimary} />
            <Text style={styles.addSiteText}>Add another booking site</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM ACTIONS */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          style={[styles.saveBtn, busy && { opacity: 0.6 }]}
          disabled={!!busy}
          onPress={save}
          activeOpacity={0.85}
        >
          {busy === 'save' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="save-outline" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.saveBtnText}>{busy === 'save' ? 'Saving...' : 'Save & Sync'}</Text>
        </TouchableOpacity>

        {cal.imports.length > 0 && (
          <TouchableOpacity
            style={[styles.syncNowBtn, busy && { opacity: 0.6 }]}
            disabled={!!busy}
            onPress={syncNow}
            activeOpacity={0.8}
          >
            {busy === 'sync' ? (
              <ActivityIndicator size="small" color={Colors.brandPrimary} />
            ) : (
              <Ionicons name="refresh" size={15} color={Colors.brandPrimary} />
            )}
            <Text style={styles.syncNowText}>{busy === 'sync' ? 'Syncing...' : 'Sync Now'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    padding: 14,
    borderRadius: Radii.card,
    backgroundColor: '#FAF9FE',
    borderWidth: 1,
    borderColor: '#ECE7F6',
  },
  loadingBox: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.statusRedBg,
    marginTop: 10,
  },
  errorText: {
    fontSize: 12,
    color: Colors.statusRed,
    fontWeight: '500',
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE7F6',
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.brandPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    backgroundColor: Colors.statusGreenBg,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.statusGreen,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.statusGreen,
  },
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  guideToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandPrimary,
    flex: 1,
  },
  guideCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE7F6',
    marginBottom: 10,
  },
  guideStep: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardSection: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE7F6',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionCaption: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 16,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F5FC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E8E2F4',
    marginBottom: 8,
  },
  urlText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.brandPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.brandPrimaryLight,
  },
  actionBtnCopied: {
    backgroundColor: Colors.statusGreenBg,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandPrimary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  inputWrapper: {
    marginBottom: 8,
  },
  otaBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  otaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FAF9FE',
    borderWidth: 1,
    borderColor: '#E2DCF0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  deleteLinkBtn: {
    marginLeft: 6,
    padding: 2,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingLeft: 2,
  },
  syncStatusText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  addSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  addSiteText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.button,
    paddingVertical: 11,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.brandPrimaryLight,
    borderRadius: Radii.button,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  syncNowText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brandPrimary,
  },
});
