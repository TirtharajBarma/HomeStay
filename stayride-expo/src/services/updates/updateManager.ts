import { useEffect, useState, useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CURRENT_RELEASE_VERSION,
  RELEASE_DESCRIPTION,
  INITIAL_RELEASE_HISTORY,
  ReleaseHistoryItem,
} from '../../constants/version';

const DISCOVERED_KEY = '@app_update_discovered_at';
const PENDING_MESSAGE_KEY = '@app_update_pending_message';
const ACTIVE_VERSION_KEY = '@app_update_active_version';
const ACTIVE_MESSAGE_KEY = '@app_update_active_message';
const LAST_CHECKED_KEY = '@app_update_last_checked_at';
const RELEASE_HISTORY_KEY = '@app_update_history_v2';
const AUTO_OTA_KEY = '@app_setting_auto_ota_v1';
const AUTO_APPLY_48H_KEY = '@app_setting_auto_apply_48h_v1';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

// ── Types ───────────────────────────────────────────────────

export interface ParsedRelease {
  version: string;
  cleanVersion: string;
  notes: string[];
  summary: string;
  isNativeRequired: boolean;
  nativeNotice?: string;
  buildUrl?: string | null;
  rawMessage: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up_to_date'
  | 'native_required'
  | 'dev_mode'
  | 'error';

export interface AppUpdateInfo {
  isEnabled: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isDownloading: boolean;
  /** 0..1 while downloading if expo-updates reports it, otherwise null (indeterminate). */
  downloadProgress: number | null;
  activeVersion: string;
  activeRelease: ParsedRelease;
  availableRelease: ParsedRelease | null;
  history: ReleaseHistoryItem[];
  updateId: string | null;
  channel: string;
  runtimeVersion: string;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  lastCheckedAt: number | null;
  discoveredAt: number | null;
  daysRemainingBeforeAutoUpdate: number | null;
  manualStatus: UpdateStatus;
  errorMessage: string | null;
  autoOtaEnabled: boolean;
  autoApply48hEnabled: boolean;
  setAutoOtaEnabled: (val: boolean) => Promise<void>;
  setAutoApply48hEnabled: (val: boolean) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToApply: () => Promise<void>;
  openBuildUrl: () => Promise<void>;
  contactAdmin: (targetVersion?: string) => Promise<void>;
}

// ── Semantic Version Utilities ─────────────────────────────

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export function parseSemVer(verStr: string | null | undefined): SemVer | null {
  if (!verStr || typeof verStr !== 'string') return null;
  const cleaned = verStr.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
    raw: verStr.trim(),
  };
}

export function semverCompare(vA: string | null | undefined, vB: string | null | undefined): number {
  const parsedA = parseSemVer(vA);
  const parsedB = parseSemVer(vB);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;

  if (parsedA.major !== parsedB.major) return parsedA.major > parsedB.major ? 1 : -1;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor > parsedB.minor ? 1 : -1;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch > parsedB.patch ? 1 : -1;
  return 0;
}

// ── Manifest Message & Version Extraction ──────────────────

export function extractUpdateMessage(manifest: any): string | null {
  if (!manifest) return null;
  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return manifest.trim().length > 0 ? manifest.trim() : null;
    }
  }

  if (parsed?.extra?.expoClient?.extra?.easUpdateMessage) return String(parsed.extra.expoClient.extra.easUpdateMessage);
  if (parsed?.extra?.expoClient?.extra?.updateMessage) return String(parsed.extra.expoClient.extra.updateMessage);
  if (parsed?.extra?.updateMessage) return String(parsed.extra.updateMessage);
  if (parsed?.extra?.easUpdateMessage) return String(parsed.extra.easUpdateMessage);
  if (parsed?.extra?.expoClient?.extra?.updateDescription) return String(parsed.extra.expoClient.extra.updateDescription);

  if (parsed?.metadata) {
    if (typeof parsed.metadata === 'object' && parsed.metadata !== null) {
      if (parsed.metadata.message) return String(parsed.metadata.message);
      if (parsed.metadata.msg) return String(parsed.metadata.msg);
    }
    if (typeof parsed.metadata === 'string') {
      try {
        const metaObj = JSON.parse(parsed.metadata);
        if (metaObj?.message) return String(metaObj.message);
      } catch {
        if (!parsed.metadata.startsWith('{')) return String(parsed.metadata).trim();
      }
    }
  }

  if (parsed?.extra?.expoClient?.extra?.eas?.message) return String(parsed.extra.expoClient.extra.eas.message);
  if (parsed?.extra?.eas?.message) return String(parsed.extra.eas.message);
  if (parsed?.message) return String(parsed.message);

  return null;
}

export function extractManifestVersion(manifest: any): string | null {
  if (!manifest) return null;
  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return null;
    }
  }

  if (parsed?.extra?.expoClient?.extra?.updateVersion) return String(parsed.extra.expoClient.extra.updateVersion);
  if (parsed?.extra?.updateVersion) return String(parsed.extra.updateVersion);
  if (parsed?.extra?.expoClient?.version) {
    const v = String(parsed.extra.expoClient.version).trim();
    return v.startsWith('v') ? v : `v${v}`;
  }

  const msg = extractUpdateMessage(parsed);
  if (msg) {
    const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (match && match[1]) return `v${match[1]}`;
  }
  return null;
}

// ── Release Payload Parser ──────────────────────────────────

export function parseReleasePayload(
  rawMessage: string | null | undefined,
  fallbackVersion: string = CURRENT_RELEASE_VERSION
): ParsedRelease {
  let cleanRaw = (rawMessage || '').trim();
  const isEssentiallyEmpty = !cleanRaw || /^(?:v)?\d+\.\d+(?:\.\d+)?:\s*$/i.test(cleanRaw);

  if (isEssentiallyEmpty) {
    const sem = parseSemVer(fallbackVersion);
    const vStr = sem ? `v${sem.major}.${sem.minor}.${sem.patch}` : fallbackVersion;
    const histItem = INITIAL_RELEASE_HISTORY.find((h) => h.version === vStr);

    return {
      version: vStr,
      cleanVersion: sem ? `${sem.major}.${sem.minor}.${sem.patch}` : fallbackVersion.replace(/^v/i, ''),
      notes: histItem?.notes || ['Verified performance optimizations, bug fixes, and improvements.'],
      summary: histItem?.title || 'Performance optimizations and improvements.',
      isNativeRequired: false,
      buildUrl: null,
      rawMessage: '',
    };
  }

  const nativeKeywordsRegex =
    /(?:new\s+native\s+build\s+required|apk\/ipa\s+required|new\s+apk|new\s+ipa|requires?\s+(?:a\s+)?new\s+(?:native\s+)?build)/i;
  const isNativeRequired = nativeKeywordsRegex.test(cleanRaw);

  const urlMatch = cleanRaw.match(/https:\/\/[^\s"'`<>]+/i);
  let buildUrl: string | null = urlMatch ? urlMatch[0] : null;

  const rawLines = cleanRaw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const firstLine = rawLines[0] || '';

  const versionMatch = firstLine.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
  const finalVersion = versionMatch ? `v${versionMatch[1]}` : fallbackVersion;
  const sem = parseSemVer(finalVersion);
  const cleanVersion = sem ? `${sem.major}.${sem.minor}.${sem.patch}` : finalVersion.replace(/^v/i, '');

  const stripBulletPrefix = (s: string) =>
    s
      .replace(/^[\s•\-\*–—\u2022\u25E6\u2023\u2219]+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]?\s*/i, '')
      .trim();

  const cleanNotes: string[] = [];
  if (rawLines.length > 1) {
    for (let i = 1; i < rawLines.length; i++) {
      const line = stripBulletPrefix(rawLines[i]);
      if (line.length > 0) cleanNotes.push(line);
    }
  } else {
    let desc = firstLine.replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]\s*/i, '').trim();
    if (desc.includes('•') || desc.includes(';') || desc.includes(' | ')) {
      cleanNotes.push(...desc.split(/[•;|]/).map(stripBulletPrefix).filter((p) => p.length > 0));
    } else if (desc.length > 0) {
      cleanNotes.push(stripBulletPrefix(desc));
    }
  }

  if (cleanNotes.length === 0) {
    cleanNotes.push('Performance optimizations and bug fixes.');
  }

  return {
    version: finalVersion,
    cleanVersion,
    notes: cleanNotes,
    summary: cleanNotes.join(' · '),
    isNativeRequired,
    buildUrl,
    rawMessage: cleanRaw,
  };
}

// ── Release History & Version Resolvers ─────────────────────

export async function getReleaseHistory(): Promise<ReleaseHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RELEASE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_RELEASE_HISTORY;
}

export async function recordAppliedRelease(release: ParsedRelease): Promise<void> {
  try {
    const history = await getReleaseHistory();
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newItem: ReleaseHistoryItem = {
      version: release.version,
      date: dateStr,
      notes: release.notes,
      isNativeBuild: release.isNativeRequired,
    };
    const filtered = history.filter((h) => h.version !== release.version);
    await AsyncStorage.setItem(RELEASE_HISTORY_KEY, JSON.stringify([newItem, ...filtered].slice(0, 15)));
  } catch {}
}

export async function getActiveAppVersion(): Promise<string> {
  try {
    // Prefer extra.updateVersion: expo.version is the runtime (binary) version and
    // is no longer bumped per OTA.
    const manifestVer = extractManifestVersion(Updates.manifest);
    if (manifestVer) {
      return `v${String(manifestVer).replace(/^v/i, '')}`;
    }
    const cached = await AsyncStorage.getItem(ACTIVE_VERSION_KEY);
    if (cached) return cached;
  } catch {}
  return CURRENT_RELEASE_VERSION;
}

// ── Silent Background Auto-Apply ────────────────────────────

export async function checkAndAutoApplyUpdates(): Promise<void> {
  if (!Updates.isEnabled) return;

  try {
    const autoOtaVal = await AsyncStorage.getItem(AUTO_OTA_KEY);
    if (autoOtaVal === 'false') return;

    const discoveredStr = await AsyncStorage.getItem(DISCOVERED_KEY);
    const discoveredAt = discoveredStr ? parseInt(discoveredStr, 10) : null;

    const checkResult = await Updates.checkForUpdateAsync();

    if (checkResult.isAvailable) {
      const now = Date.now();
      const firstSeen = discoveredAt || now;
      if (!discoveredAt) await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());

      const msg = extractUpdateMessage(checkResult.manifest);
      const manifestVer = extractManifestVersion(checkResult.manifest);
      const targetVer = manifestVer || parseReleasePayload(msg).version;
      const activeVer = await getActiveAppVersion();

      // Guard: Never downgrade active build
      if (!checkResult.isRollBackToEmbedded && targetVer && semverCompare(targetVer, activeVer) <= 0) {
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        return;
      }

      const parsed = parseReleasePayload(msg, targetVer || undefined);
      if (parsed.isNativeRequired) return;

      if (msg) await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);

      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      const isAutoApplyEnabled = autoApplyVal !== 'false';

      // 48-hour silent auto-apply: only download once the grace period has passed
      // (a fetched update is applied by expo-updates on the next launch). Never
      // reloadAsync() here — that would restart the app mid-session and lose input.
      if (isAutoApplyEnabled && now - firstSeen >= TWO_DAYS_MS) {
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          if (msg) {
            await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, msg);
            await AsyncStorage.setItem(ACTIVE_VERSION_KEY, parsed.version);
            await recordAppliedRelease(parsed);
          }
          await AsyncStorage.removeItem(DISCOVERED_KEY);
          await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        }
      }
    } else {
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
    }
  } catch {
    // Fail silently in background
  }
}

// ── Unified Hook for UI ────────────────────────────────────

export function useAppUpdateManager(): AppUpdateInfo {
  const [discoveredAt, setDiscoveredAt] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [storedMessage, setStoredMessage] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string>(CURRENT_RELEASE_VERSION);
  const [history, setHistory] = useState<ReleaseHistoryItem[]>(INITIAL_RELEASE_HISTORY);
  const [manualStatus, setManualStatus] = useState<UpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isManualDownloading, setIsManualDownloading] = useState(false);
  const [autoOtaEnabled, setAutoOtaEnabledState] = useState<boolean>(true);
  const [autoApply48hEnabled, setAutoApply48hEnabledState] = useState<boolean>(true);
  const [checkedManifest, setCheckedManifest] = useState<any | null>(null);

  const {
    currentlyRunning,
    availableUpdate,
    downloadedUpdate,
    isUpdateAvailable: hookAvailable,
    isUpdatePending: hookPending,
    isDownloading: hookDownloading,
    downloadProgress: hookDownloadProgress,
  } = Updates.useUpdates();

  useEffect(() => {
    async function loadData() {
      const isEmbedded = Boolean(currentlyRunning.isEmbeddedLaunch || !currentlyRunning.updateId);
      // Evict stale OTA keys if running fresh embedded binary
      if (isEmbedded) {
        await AsyncStorage.multiRemove([ACTIVE_VERSION_KEY, ACTIVE_MESSAGE_KEY, PENDING_MESSAGE_KEY, DISCOVERED_KEY]).catch(() => {});
      }

      const ver = isEmbedded ? CURRENT_RELEASE_VERSION : await getActiveAppVersion();
      const hist = await getReleaseHistory();
      setActiveVersion(ver);
      setHistory(hist);

      const discVal = await AsyncStorage.getItem(DISCOVERED_KEY);
      if (discVal) setDiscoveredAt(parseInt(discVal, 10));

      const lastCheckedVal = await AsyncStorage.getItem(LAST_CHECKED_KEY);
      if (lastCheckedVal) setLastCheckedAt(parseInt(lastCheckedVal, 10));

      const pendMsg = await AsyncStorage.getItem(PENDING_MESSAGE_KEY);
      const activeMsg = await AsyncStorage.getItem(ACTIVE_MESSAGE_KEY);
      setStoredMessage(isEmbedded ? RELEASE_DESCRIPTION : (pendMsg || activeMsg));

      const autoOtaVal = await AsyncStorage.getItem(AUTO_OTA_KEY);
      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      setAutoOtaEnabledState(autoOtaVal !== 'false');
      setAutoApply48hEnabledState(autoApplyVal !== 'false');
    }
    loadData();
  }, [currentlyRunning]);

  const isUpdatePending = hookPending || manualStatus === 'downloaded';
  const isUpdateAvailable = hookAvailable || manualStatus === 'available';
  const isDownloading = hookDownloading || isManualDownloading;
  const downloadProgress =
    isDownloading && typeof hookDownloadProgress === 'number' ? hookDownloadProgress : null;

  const activeRelease = useMemo(() => {
    return parseReleasePayload(storedMessage, activeVersion);
  }, [storedMessage, activeVersion]);

  const availableRelease = useMemo(() => {
    if (!isUpdateAvailable && !isUpdatePending && manualStatus !== 'native_required') return null;
    const targetManifest = checkedManifest || downloadedUpdate?.manifest || availableUpdate?.manifest;
    const msg = extractUpdateMessage(targetManifest) || storedMessage;
    const ver = extractManifestVersion(targetManifest);
    return parseReleasePayload(msg, ver || undefined);
  }, [isUpdateAvailable, isUpdatePending, manualStatus, checkedManifest, downloadedUpdate, availableUpdate, storedMessage]);

  const daysRemainingBeforeAutoUpdate = discoveredAt
    ? Math.max(0, Math.ceil((discoveredAt + TWO_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const handleCheckForUpdates = useCallback(async () => {
    if (!Updates.isEnabled) {
      setManualStatus('dev_mode');
      return;
    }
    setManualStatus('checking');
    setErrorMessage(null);
    try {
      const now = Date.now();
      setLastCheckedAt(now);
      await AsyncStorage.setItem(LAST_CHECKED_KEY, now.toString());

      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setCheckedManifest(result.manifest);
        const msg = extractUpdateMessage(result.manifest);
        const parsed = parseReleasePayload(msg);
        if (parsed.isNativeRequired) {
          setManualStatus('native_required');
        } else {
          setManualStatus('available');
          setDiscoveredAt(now);
          await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());
        }
      } else {
        setManualStatus('up_to_date');
      }
    } catch {
      setManualStatus('error');
      setErrorMessage('Unable to check for updates. Check internet connection.');
    }
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;
    setIsManualDownloading(true);
    setErrorMessage(null);
    try {
      const result = await Updates.fetchUpdateAsync();
      const msg = extractUpdateMessage(result.manifest);
      if (msg) await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      setManualStatus('downloaded');
    } catch {
      setManualStatus('error');
      setErrorMessage('Download failed. Please check your connection.');
    } finally {
      setIsManualDownloading(false);
    }
  }, []);

  const handleRestartToApply = useCallback(async () => {
    try {
      // Record the downloaded (pending) update, not the currently active one.
      if (availableRelease) {
        if (availableRelease.rawMessage) {
          await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, availableRelease.rawMessage);
        }
        await AsyncStorage.setItem(ACTIVE_VERSION_KEY, availableRelease.version);
        await recordAppliedRelease(availableRelease);
      }
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await Updates.reloadAsync();
    } catch {
      Updates.reloadAsync().catch(() => {});
    }
  }, [availableRelease]);

  return {
    isEnabled: Updates.isEnabled,
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    activeRelease,
    availableRelease,
    history,
    updateId: currentlyRunning.updateId || Updates.updateId || null,
    channel: Updates.channel || 'preview',
    runtimeVersion: Updates.runtimeVersion || '1',
    isEmbeddedLaunch: Boolean(currentlyRunning.isEmbeddedLaunch),
    createdAt: currentlyRunning.createdAt || Updates.createdAt || null,
    lastCheckedAt,
    discoveredAt,
    daysRemainingBeforeAutoUpdate,
    manualStatus,
    errorMessage,
    autoOtaEnabled,
    autoApply48hEnabled,
    setAutoOtaEnabled: async (val) => {
      setAutoOtaEnabledState(val);
      await AsyncStorage.setItem(AUTO_OTA_KEY, String(val)).catch(() => {});
    },
    setAutoApply48hEnabled: async (val) => {
      setAutoApply48hEnabledState(val);
      await AsyncStorage.setItem(AUTO_APPLY_48H_KEY, String(val)).catch(() => {});
    },
    checkForUpdates: handleCheckForUpdates,
    downloadUpdate: handleDownloadUpdate,
    restartToApply: handleRestartToApply,
    openBuildUrl: async () => {
      if (availableRelease?.buildUrl) {
        await Linking.openURL(availableRelease.buildUrl);
      }
    },
    contactAdmin: async () => {
      await Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(`New build update for StayRide: ${activeVersion}`)}`);
    },
  };
}
