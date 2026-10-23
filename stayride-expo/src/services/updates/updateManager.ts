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

  // 1. Direct extra update fields from app.json / EAS
  if (parsed?.extra?.expoClient?.extra?.easUpdateMessage) return String(parsed.extra.expoClient.extra.easUpdateMessage);
  if (parsed?.extra?.expoClient?.extra?.updateMessage) return String(parsed.extra.expoClient.extra.updateMessage);
  if (parsed?.extra?.updateMessage) return String(parsed.extra.updateMessage);
  if (parsed?.extra?.easUpdateMessage) return String(parsed.extra.easUpdateMessage);
  if (parsed?.extra?.expoClient?.extra?.updateDescription) return String(parsed.extra.expoClient.extra.updateDescription);

  // 2. Metadata object / JSON string from EAS Update
  if (parsed?.metadata) {
    if (typeof parsed.metadata === 'object' && parsed.metadata !== null) {
      if (parsed.metadata.message) return String(parsed.metadata.message);
      if (parsed.metadata.msg) return String(parsed.metadata.msg);
    }
    if (typeof parsed.metadata === 'string') {
      try {
        const metaObj = JSON.parse(parsed.metadata);
        if (metaObj?.message) return String(metaObj.message);
        if (metaObj?.msg) return String(metaObj.msg);
      } catch {
        if (!parsed.metadata.startsWith('{') && parsed.metadata.trim().length > 0) {
          return String(parsed.metadata).trim();
        }
      }
    }
  }

  // 3. Extra EAS / expoClient objects
  if (parsed?.extra?.expoClient?.extra?.eas?.message) return String(parsed.extra.expoClient.extra.eas.message);
  if (parsed?.extra?.eas?.message) return String(parsed.extra.eas.message);
  if (parsed?.extra?.message) return String(parsed.extra.message);
  if (parsed?.message) return String(parsed.message);
  if (parsed?.raw?.metadata?.message) return String(parsed.raw.metadata.message);

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

  // 1. Direct explicit updateVersion in extra
  if (parsed?.extra?.expoClient?.extra?.updateVersion) return String(parsed.extra.expoClient.extra.updateVersion);
  if (parsed?.extra?.updateVersion) return String(parsed.extra.updateVersion);

  // 2. Extract version tag from the EAS update message (e.g. "v1.0.2: Fix split settlement")
  const msg = extractUpdateMessage(parsed);
  let msgVersion: string | null = null;
  if (msg) {
    const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (match && match[1]) {
      msgVersion = `v${match[1]}`;
    }
  }

  // 3. Fallback to expoClient version from app.json
  let appVersion: string | null = null;
  if (parsed?.extra?.expoClient?.version) {
    const v = String(parsed.extra.expoClient.version).trim();
    appVersion = v.startsWith('v') ? v : `v${v}`;
  } else if (parsed?.version) {
    const v = String(parsed.version).trim();
    appVersion = v.startsWith('v') ? v : `v${v}`;
  }

  // If message has an explicit version tag (e.g. "v1.0.2"), prefer it over the static base version
  if (msgVersion) {
    if (!appVersion || semverCompare(msgVersion, appVersion) >= 0) {
      return msgVersion;
    }
  }

  return appVersion || msgVersion;
}

/**
 * Calculates next patch semver bump (e.g. v1.0.1 -> v1.0.2).
 */
export function getNextIncrementedVersion(currentVersion: string): string {
  const sem = parseSemVer(currentVersion);
  if (!sem) return currentVersion;
  return `v${sem.major}.${sem.minor}.${sem.patch + 1}`;
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure CURRENT_RELEASE_VERSION is in history
        const hasCurrent = parsed.some((h: ReleaseHistoryItem) => h.version === CURRENT_RELEASE_VERSION);
        if (!hasCurrent && INITIAL_RELEASE_HISTORY[0]) {
          return [INITIAL_RELEASE_HISTORY[0], ...parsed.filter((h: ReleaseHistoryItem) => h.version !== CURRENT_RELEASE_VERSION)].slice(0, 15);
        }
        return parsed;
      }
    }
  } catch {}
  return INITIAL_RELEASE_HISTORY;
}

export async function recordAppliedRelease(release: ParsedRelease, updateDate?: Date): Promise<void> {
  try {
    const history = await getReleaseHistory();
    const dateStr = (updateDate || new Date()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const newItem: ReleaseHistoryItem = {
      version: release.version,
      date: dateStr,
      title: release.summary,
      notes: release.notes,
      type: 'ota',
      isNativeBuild: release.isNativeRequired,
    };
    const filtered = history.filter((h) => h.version !== release.version);
    await AsyncStorage.setItem(RELEASE_HISTORY_KEY, JSON.stringify([newItem, ...filtered].slice(0, 15)));
  } catch {}
}

export async function getActiveAppVersion(manifest?: any): Promise<string> {
  try {
    const targetManifest = manifest || Updates.manifest;
    const manifestVer = extractManifestVersion(targetManifest);
    if (manifestVer) {
      const vStr = `v${String(manifestVer).replace(/^v/i, '')}`;
      await AsyncStorage.setItem(ACTIVE_VERSION_KEY, vStr);
      return vStr;
    }
    const cached = await AsyncStorage.getItem(ACTIVE_VERSION_KEY);
    if (cached) return cached;
  } catch {}
  return CURRENT_RELEASE_VERSION;
}

export function getActiveAppVersionSync(): string {
  try {
    const manifestVer = extractManifestVersion(Updates.manifest);
    if (manifestVer) {
      return `v${String(manifestVer).replace(/^v/i, '')}`;
    }
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
      const targetVer = manifestVer || (msg ? parseReleasePayload(msg).version : null);
      const activeVer = await getActiveAppVersion();

      // Guard: Never downgrade active build
      if (!checkResult.isRollBackToEmbedded && targetVer && semverCompare(targetVer, activeVer) <= 0) {
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        return;
      }

      const parsed = parseReleasePayload(msg, targetVer || undefined);
      if (parsed.isNativeRequired) return;

      if (msg) await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);

      // Pre-fetch the update in background so it's ready to apply
      const fetchResult = await Updates.fetchUpdateAsync();

      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      const isAutoApplyEnabled = autoApplyVal !== 'false';

      // 48-hour silent auto-apply: if 48h elapsed, record and apply immediately
      if (fetchResult.isNew && isAutoApplyEnabled && now - firstSeen >= TWO_DAYS_MS) {
        if (msg) {
          await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, msg);
          await AsyncStorage.setItem(ACTIVE_VERSION_KEY, parsed.version);
          await recordAppliedRelease(parsed);
        }
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        await Updates.reloadAsync();
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
  const [activeVersion, setActiveVersion] = useState<string>(() => getActiveAppVersionSync());
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
    let isMounted = true;
    async function loadData() {
      const isEmbedded = Boolean(currentlyRunning.isEmbeddedLaunch || !currentlyRunning.updateId);
      // Evict stale OTA keys if running fresh embedded binary
      if (isEmbedded) {
        await AsyncStorage.multiRemove([ACTIVE_VERSION_KEY, ACTIVE_MESSAGE_KEY, PENDING_MESSAGE_KEY, DISCOVERED_KEY]).catch(() => {});
      }

      const ver = isEmbedded ? CURRENT_RELEASE_VERSION : await getActiveAppVersion(currentlyRunning.manifest || Updates.manifest);
      const hist = await getReleaseHistory();

      if (isMounted) {
        setActiveVersion(ver);
        setHistory(hist);
      }

      // If running an OTA update and this version isn't in history yet, record it
      if (!isEmbedded && ver !== CURRENT_RELEASE_VERSION) {
        const hasVer = hist.some((h) => h.version === ver);
        if (!hasVer) {
          const liveMsg = extractUpdateMessage(currentlyRunning.manifest) || extractUpdateMessage(Updates.manifest);
          const parsed = parseReleasePayload(liveMsg, ver);
          await recordAppliedRelease(parsed);
          const updatedHist = await getReleaseHistory();
          if (isMounted) setHistory(updatedHist);
        }
      }

      const discVal = await AsyncStorage.getItem(DISCOVERED_KEY);
      if (isMounted && discVal) setDiscoveredAt(parseInt(discVal, 10));

      const lastCheckedVal = await AsyncStorage.getItem(LAST_CHECKED_KEY);
      if (isMounted && lastCheckedVal) setLastCheckedAt(parseInt(lastCheckedVal, 10));

      const pendMsg = await AsyncStorage.getItem(PENDING_MESSAGE_KEY);
      const activeMsg = await AsyncStorage.getItem(ACTIVE_MESSAGE_KEY);
      const liveMsg = extractUpdateMessage(currentlyRunning.manifest) || extractUpdateMessage(Updates.manifest);
      if (isMounted) {
        setStoredMessage(isEmbedded ? RELEASE_DESCRIPTION : (pendMsg || liveMsg || activeMsg));
      }

      const autoOtaVal = await AsyncStorage.getItem(AUTO_OTA_KEY);
      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      if (isMounted) {
        setAutoOtaEnabledState(autoOtaVal !== 'false');
        setAutoApply48hEnabledState(autoApplyVal !== 'false');
      }
    }
    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentlyRunning]);

  // Reactive listener to incoming updates
  useEffect(() => {
    const updateManifest = downloadedUpdate?.manifest || availableUpdate?.manifest;
    if (updateManifest) {
      const msg = extractUpdateMessage(updateManifest);
      if (msg) {
        setStoredMessage(msg);
        AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg).catch(() => {});
      }
    }
  }, [availableUpdate, downloadedUpdate]);

  const isUpdatePending = hookPending || manualStatus === 'downloaded';
  const isUpdateAvailable = hookAvailable || manualStatus === 'available';
  const isDownloading = hookDownloading || isManualDownloading;
  const downloadProgress =
    isDownloading && typeof hookDownloadProgress === 'number' ? hookDownloadProgress : null;

  const activeRelease = useMemo(() => {
    const isEmbedded = Boolean(currentlyRunning.isEmbeddedLaunch || !currentlyRunning.updateId);
    if (isEmbedded) {
      return parseReleasePayload(RELEASE_DESCRIPTION, CURRENT_RELEASE_VERSION);
    }
    const liveMsg =
      extractUpdateMessage(currentlyRunning?.manifest) ||
      extractUpdateMessage(Updates.manifest) ||
      storedMessage;
    return parseReleasePayload(liveMsg, activeVersion);
  }, [currentlyRunning, storedMessage, activeVersion]);

  const availableRelease = useMemo(() => {
    if (!isUpdateAvailable && !isUpdatePending && manualStatus !== 'native_required') return null;
    const targetManifest = checkedManifest || downloadedUpdate?.manifest || availableUpdate?.manifest;
    const msg = extractUpdateMessage(targetManifest) || storedMessage;
    const manifestVer = extractManifestVersion(targetManifest);

    let targetVersion = manifestVer;
    if (!targetVersion && msg) {
      const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
      if (match && match[1]) targetVersion = `v${match[1]}`;
    }
    if (!targetVersion) {
      const topHistory = history.find((h) => h.version !== activeVersion);
      targetVersion = topHistory?.version || getNextIncrementedVersion(activeVersion);
    }

    if (targetVersion && semverCompare(targetVersion, activeVersion) <= 0) {
      return null;
    }

    return parseReleasePayload(msg, targetVersion || undefined);
  }, [isUpdateAvailable, isUpdatePending, manualStatus, checkedManifest, downloadedUpdate, availableUpdate, storedMessage, activeVersion, history]);

  const [currentTime] = useState(() => Date.now());
  const daysRemainingBeforeAutoUpdate = discoveredAt
    ? Math.max(0, Math.ceil((discoveredAt + TWO_DAYS_MS - currentTime) / (24 * 60 * 60 * 1000)))
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
      if (result.isAvailable || result.isRollBackToEmbedded) {
        setCheckedManifest(result.manifest);
        const msg = extractUpdateMessage(result.manifest);
        const manifestVer = extractManifestVersion(result.manifest);

        let targetVersion = manifestVer;
        if (!targetVersion && msg) {
          const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
          if (match && match[1]) targetVersion = `v${match[1]}`;
        }
        if (!targetVersion) {
          const topHistory = history.find((h) => h.version !== activeVersion);
          targetVersion = topHistory?.version || getNextIncrementedVersion(activeVersion);
        }

        if (!result.isRollBackToEmbedded && targetVersion && semverCompare(targetVersion, activeVersion) <= 0) {
          setCheckedManifest(null);
          setManualStatus('up_to_date');
          await AsyncStorage.removeItem(DISCOVERED_KEY);
          await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
          setDiscoveredAt(null);
          return;
        }

        const parsed = parseReleasePayload(msg, targetVersion || undefined);

        if (msg) {
          setStoredMessage(msg);
          await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
        }

        if (parsed.isNativeRequired) {
          setManualStatus('native_required');
        } else {
          setManualStatus('available');
          setDiscoveredAt(now);
          await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());
        }
      } else {
        setCheckedManifest(null);
        setManualStatus('up_to_date');
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        setDiscoveredAt(null);
      }
    } catch {
      setManualStatus('error');
      setErrorMessage('Unable to check for updates. Check internet connection.');
    }
  }, [activeVersion, history]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;
    setIsManualDownloading(true);
    setErrorMessage(null);
    try {
      const result = await Updates.fetchUpdateAsync();
      const msg = extractUpdateMessage(result.manifest);
      if (msg) {
        setStoredMessage(msg);
        await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      }
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
      const targetRelease = availableRelease || (storedMessage ? parseReleasePayload(storedMessage, activeVersion) : null);
      if (targetRelease) {
        if (targetRelease.rawMessage) {
          await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, targetRelease.rawMessage);
        }
        await AsyncStorage.setItem(ACTIVE_VERSION_KEY, targetRelease.version);
        await recordAppliedRelease(targetRelease);
      }
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await Updates.reloadAsync();
    } catch {
      Updates.reloadAsync().catch(() => {});
    }
  }, [availableRelease, storedMessage, activeVersion]);

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
