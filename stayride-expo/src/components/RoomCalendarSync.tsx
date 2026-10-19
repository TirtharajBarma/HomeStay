import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStayRide } from '../data/store';
import { Colors } from '../theme/colors';
import { RoomCalendar } from '../types';

const MAX_LINKS = 3;

// Two-way calendar sync for one room with Airbnb, Booking.com and similar sites (iCal):
// give them our export link, paste their export links here.
export const RoomCalendarSync: React.FC<{ roomId: number }> = ({ roomId }) => {
  const { getRoomCalendar, setRoomCalendarLinks, syncRoomCalendar } = useStayRide();
  const [cal, setCal] = useState<RoomCalendar | null>(null);
  const [links, setLinks] = useState<string[]>(['']);
  const [busy, setBusy] = useState<'load' | 'save' | 'sync' | null>('load');
  const [error, setError] = useState('');

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
    if (lines.length) Alert.alert('Calendar synced', lines.join('\n'));
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

  if (busy === 'load') return <ActivityIndicator color={Colors.brandPrimary} style={{ marginVertical: 12 }} />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!cal) return null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Sync with Airbnb / Booking.com</Text>
      <Text style={styles.help}>
        1. Copy this room&apos;s link and add it as an imported calendar on Airbnb / Booking.com, so they block dates booked here.
      </Text>
      <Text style={styles.link} numberOfLines={2}>
        {cal.exportUrl}
      </Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.smallBtn} onPress={() => Clipboard.setStringAsync(cal.exportUrl).then(() => Alert.alert('Copied', 'Paste it into Airbnb / Booking.com.'))}>
          <Text style={styles.smallBtnText}>Copy link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={() => Share.share({ message: cal.exportUrl }).catch(() => {})}>
          <Text style={styles.smallBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.help, { marginTop: 12 }]}>
        2. Paste each site&apos;s calendar export link (iCal) for this room. Their bookings then block dates here.
      </Text>
      {links.map((l, i) => {
        const imp = cal.imports.find((x) => x.url === l.trim());
        return (
          <View key={i} style={{ marginTop: 6 }}>
            <TextInput
              style={styles.input}
              placeholder="https://www.airbnb.com/calendar/ical/…"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              value={l}
              onChangeText={(t) => setLinks((prev) => prev.map((x, j) => (j === i ? t : x)))}
            />
            {imp && (
              <Text style={[styles.status, imp.lastError ? { color: Colors.statusRed } : null]}>
                {imp.source} ·{' '}
                {imp.lastError
                  ? imp.lastError
                  : imp.lastSyncAt
                  ? `synced ${new Date(imp.lastSyncAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${imp.eventCount} booking(s)`
                  : 'not synced yet'}
              </Text>
            )}
          </View>
        );
      })}
      {links.length < MAX_LINKS && (
        <TouchableOpacity onPress={() => setLinks((p) => [...p, ''])}>
          <Text style={styles.addLink}>+ Add another site</Text>
        </TouchableOpacity>
      )}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.mainBtn, busy && { opacity: 0.6 }]} disabled={!!busy} onPress={save}>
          <Text style={styles.mainBtnText}>{busy === 'save' ? 'Saving…' : 'Save & sync'}</Text>
        </TouchableOpacity>
        {cal.imports.length > 0 && (
          <TouchableOpacity style={[styles.smallBtn, busy && { opacity: 0.6 }]} disabled={!!busy} onPress={syncNow}>
            <Text style={styles.smallBtnText}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: Colors.divider },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  help: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 17 },
  link: { fontSize: 11, color: Colors.brandPrimaryDark, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.brandPrimaryLight },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: Colors.brandPrimaryDark },
  mainBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.brandPrimary },
  mainBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  status: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  addLink: { fontSize: 12, fontWeight: '700', color: Colors.brandPrimaryDark, marginTop: 8 },
  error: { fontSize: 12, color: Colors.statusRed, marginTop: 10 },
});
