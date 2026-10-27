/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates & Local Builds
 */
export const CURRENT_RELEASE_VERSION = "v1.0.3";
export const RELEASE_DESCRIPTION = "Unified cab booking with radar buffer, direct driver dialing, and security hardening";
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const ADMIN_NAME = process.env.EXPO_PUBLIC_APP_NAME ? `${process.env.EXPO_PUBLIC_APP_NAME} Admin` : "Platform Admin";
export const AUTHOR_CREDIT = "Built with ❤️ for Mountain Hospitality";

export interface ReleaseHistoryItem {
  version: string;
  date: string;
  title?: string;
  notes: string[];
  type?: 'ota' | 'binary';
  isNativeBuild?: boolean;
}

export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [
  {
    version: "v1.0.3",
    date: "Oct 27, 2026",
    title: "Unified cab booking with radar animation • Direct driver dialing • Production security & admin controls",
    notes: [
      "Unified cab booking into a single flow with auto-prioritizing own fleet and regional drivers",
      "Added 3.5s radar wave scanning animation when submitting cab requests",
      "Added direct one-tap phone dialing button for fleet drivers on iOS and Android",
      "Hardened admin session controls and dynamic mountain terrain surcharge support",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.0.2",
    date: "Oct 24, 2026",
    title: "Dynamic settings version badge • Live OTA discovery • Enhanced changelog and release notes",
    notes: [
      "Live OTA version display and Apple-style update badges in settings",
      "Real-time background update discovery and instant restart",
      "Enhanced changelog and release notes parser",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.0.1",
    date: "Oct 23, 2026",
    title: "Initial OTA update verification with atomic version sync and automatic boot-time discovery",
    notes: [
          "Initial OTA update verification with atomic version sync and automatic boot-time discovery"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.0.0",
    date: "Current Release",
    title: "Initial Base Release",
    notes: [
      "Initial production release with offline-first support and EAS updates",
    ],
    type: "binary",
    isNativeBuild: true,
  },
];
