import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useStayRide } from '../data/store';

export const SyncBanner: React.FC = () => {
  const { outboxCount, backendStatus, syncing } = useStayRide();

  const queued = outboxCount;
  const online = backendStatus === 'connected';
  const checking = backendStatus === 'checking';
  const busy = syncing || checking || (online && queued > 0);

  let icon: keyof typeof Ionicons.glyphMap = 'cloud-done';
  let text = 'Synced';
  let bg = Colors.statusGreenBg;
  let fg = Colors.statusGreen;

  if (busy) {
    icon = 'sync';
    text = queued > 0 ? `Syncing ${queued} change${queued === 1 ? '' : 's'}…` : checking ? 'Connecting…' : 'Syncing…';
    bg = Colors.statusBlueBg;
    fg = Colors.statusBlue;
  } else if (queued > 0) {
    icon = 'cloud-offline';
    text = `Offline — ${queued} change${queued === 1 ? '' : 's'} queued`;
    bg = Colors.statusOrangeBg;
    fg = Colors.statusOrange;
  } else if (!online) {
    icon = 'cloud-offline';
    text = 'Offline';
    bg = Colors.statusOrangeBg;
    fg = Colors.statusOrange;
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Ionicons name={icon} size={14} color={fg} />
      )}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
