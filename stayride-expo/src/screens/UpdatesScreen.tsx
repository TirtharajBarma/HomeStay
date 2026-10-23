import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  RefreshCw,
  RotateCw,
  Download,
  AlertCircle,
  Copy,
  ExternalLink,
  Smartphone,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/Header';
import { Colors, Shadows, Radii } from '../theme/colors';
import { useAppUpdateManager } from '../services/updates/updateManager';

export const UpdatesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [copied, setCopied] = useState(false);

  const {
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    availableRelease,
    history,
    updateId,
    channel,
    runtimeVersion,
    isEmbeddedLaunch,
    manualStatus,
    errorMessage,
    lastCheckedAt,
    checkForUpdates,
    downloadUpdate,
    restartToApply,
    openBuildUrl,
    contactAdmin,
  } = useAppUpdateManager();

  const isChecking = manualStatus === 'checking';
  const pct = downloadProgress != null ? Math.round(downloadProgress * 100) : null;
  const isNativeRequired = manualStatus === 'native_required';

  const copyHash = async (hash: string) => {
    await Clipboard.setStringAsync(hash);
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedLastChecked = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <View style={styles.container}>
      <Header
        title="Software Updates"
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'refresh-outline',
          onPress: checkForUpdates,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={isChecking}
            onRefresh={checkForUpdates}
            tintColor={Colors.brandPrimary}
            colors={[Colors.brandPrimary]}
          />
        }
      >
        {/* ── 1. Hero Status Card ── */}
        <View style={styles.heroCard}>
          {isChecking ? (
            <ActivityIndicator size="large" color={Colors.brandPrimary} style={styles.icon} />
          ) : isUpdatePending ? (
            <RotateCw size={44} color={Colors.statusGreen} style={styles.icon} />
          ) : isUpdateAvailable ? (
            <Download size={44} color={Colors.brandPrimary} style={styles.icon} />
          ) : isNativeRequired ? (
            <Smartphone size={44} color={Colors.statusOrange} style={styles.icon} />
          ) : manualStatus === 'error' ? (
            <AlertCircle size={44} color={Colors.statusRed} style={styles.icon} />
          ) : manualStatus === 'dev_mode' ? (
            <Smartphone size={44} color={Colors.statusOrange} style={styles.icon} />
          ) : (
            <CheckCircle2 size={44} color={Colors.statusGreen} style={styles.icon} />
          )}

          <Text style={styles.heroTitle}>
            {isUpdatePending
              ? `Ready to Install ${availableRelease?.version || 'Update'}`
              : isUpdateAvailable
              ? `Update Available: ${availableRelease?.version || 'New Version'}`
              : isNativeRequired
              ? 'A new app version is required'
              : manualStatus === 'dev_mode'
              ? `StayRide ${activeVersion} (Dev Mode)`
              : `StayRide ${activeVersion}`}
          </Text>

          <Text style={styles.heroSubtitle}>
            {isChecking
              ? 'Checking for updates from EAS Cloud...'
              : isUpdatePending
              ? 'Update downloaded and verified. Restart now to apply.'
              : isUpdateAvailable
              ? availableRelease?.summary || 'New improvements ready to download.'
              : isNativeRequired
              ? `${availableRelease?.version || 'The latest release'} needs a new app install (APK/IPA) and cannot be applied over the air.`
              : manualStatus === 'dev_mode'
              ? 'EAS Updates are active in standalone APK/IPA builds. Development mode running.'
              : 'Your app is up to date with the latest release.'}
          </Text>

          {/* Action Button */}
          {isUpdatePending ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnGreen]}
              onPress={restartToApply}
              activeOpacity={0.8}
            >
              <RotateCw size={18} color="#FFFFFF" />
              <Text style={styles.btnTextWhite}>Restart to Apply</Text>
            </TouchableOpacity>
          ) : isUpdateAvailable ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={downloadUpdate}
              disabled={isDownloading}
              activeOpacity={0.8}
            >
              {isDownloading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnTextWhite}>
                    {pct != null ? `Downloading ${pct}%...` : 'Downloading...'}
                  </Text>
                </>
              ) : (
                <>
                  <Download size={18} color="#FFFFFF" />
                  <Text style={styles.btnTextWhite}>Download and Install</Text>
                </>
              )}
            </TouchableOpacity>
          ) : isNativeRequired ? (
            availableRelease?.buildUrl ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => openBuildUrl().catch(() => {})}
                activeOpacity={0.8}
              >
                <ExternalLink size={18} color="#FFFFFF" />
                <Text style={styles.btnTextWhite}>Download New App</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => contactAdmin(availableRelease?.version).catch(() => {})}
                activeOpacity={0.8}
              >
                <ExternalLink size={18} color="#FFFFFF" />
                <Text style={styles.btnTextWhite}>Contact Admin</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={checkForUpdates}
              disabled={isChecking}
              activeOpacity={0.8}
            >
              <RefreshCw size={16} color={Colors.brandPrimary} />
              <Text style={styles.btnOutlineText}>
                {isChecking ? 'Checking...' : 'Check for Updates'}
              </Text>
            </TouchableOpacity>
          )}

          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        {/* ── 2. What's New In Available Update ── */}
        {(isUpdateAvailable || isUpdatePending) && availableRelease && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>{"What's New in "}{availableRelease.version}</Text>
            {availableRelease.notes.map((note, idx) => (
              <Text key={idx} style={styles.bulletItem}>• {note}</Text>
            ))}
          </View>
        )}

        {/* ── 3. Build & System Details ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>About This Build</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Active Version</Text>
            <Text style={styles.rowValue}>{activeVersion}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Channel</Text>
            <Text style={styles.rowValue}>{channel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Runtime Version</Text>
            <Text style={styles.rowValue}>{runtimeVersion}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Installation Source</Text>
            <Text style={styles.rowValue}>
              {isEmbeddedLaunch ? 'Embedded Binary' : 'Over-the-Air (OTA)'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Last Checked</Text>
            <Text style={styles.rowValue}>{formattedLastChecked}</Text>
          </View>
          {updateId && (
            <TouchableOpacity
              style={[styles.row, { borderBottomWidth: 0 }]}
              onPress={() => copyHash(updateId)}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>Update ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.rowCode}>{updateId.slice(0, 10)}...</Text>
                <Copy size={13} color={Colors.textSecondary} />
                {copied && <Text style={styles.copiedText}>Copied</Text>}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 4. Release History ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Release History</Text>
          {history.map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.historyRow,
                idx === history.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.historyVersion}>{item.version}</Text>
                <Text style={styles.historyDate}>{item.date}</Text>
              </View>
              {item.notes.map((n, i) => (
                <Text key={i} style={styles.historyNote}>• {n}</Text>
              ))}
            </View>
          ))}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  icon: {
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: Radii.button,
  },
  btnPrimary: {
    backgroundColor: Colors.brandPrimary,
  },
  btnGreen: {
    backgroundColor: Colors.statusGreen,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimaryLight,
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radii.button,
  },
  btnOutlineText: {
    color: Colors.brandPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: Colors.statusRed,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  bulletItem: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  rowCode: {
    fontSize: 13,
    color: Colors.brandPrimary,
    fontWeight: '600',
  },
  copiedText: {
    fontSize: 11,
    color: Colors.statusGreen,
    fontWeight: '600',
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  historyVersion: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
});
