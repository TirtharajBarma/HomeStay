/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates & Local Builds
 */
export const CURRENT_RELEASE_VERSION = "v1.0.0";
export const RELEASE_DESCRIPTION = "Initial base release";
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const ADMIN_NAME = "StayRide Admin";
export const AUTHOR_CREDIT = "Built with ❤️ for StayRide";

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
