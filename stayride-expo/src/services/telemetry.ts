/**
 * Mobile Telemetry & Error Reporter for StayRide Expo
 * 
 * Reports unhandled mobile app crashes, UI glitches, or API failures
 * back to the centralized telemetry pipeline so admins/developers can see
 * what happened on real devices without user intervention.
 */

import { Platform } from 'react-native';
import { api } from '../data/api';

export interface TelemetryEvent {
  message: string;
  error?: any;
  screen?: string;
  extra?: Record<string, any>;
}

class MobileTelemetry {
  private tenantId = '';
  private driverId = '';

  public setContext(tenantId?: string, driverId?: string) {
    if (tenantId) this.tenantId = tenantId;
    if (driverId) this.driverId = driverId;
  }

  /**
   * Report an error or UI glitch to the backend telemetry pipeline.
   * Fire-and-forget: will never block UI or throw an error.
   */
  public reportError(event: TelemetryEvent) {
    try {
      const err = event.error;
      const payload = {
        message: event.message || err?.message || 'Client Exception',
        stack: err?.stack?.slice?.(0, 1000) || '',
        screen: event.screen || 'unknown',
        tenantId: this.tenantId,
        driverId: this.driverId,
        platform: Platform.OS,
        appVersion: '1.0.0',
        extra: event.extra,
      };

      // Send to server telemetry endpoint asynchronously
      api.post('/telemetry/report', payload).catch(() => {});
    } catch {
      // Ignored: telemetry must never crash the app
    }
  }

  /**
   * Track screen view transition across all mobile screens.
   */
  public trackScreen(screen: string, extra?: Record<string, any>) {
    try {
      api.post('/telemetry/event', {
        event: 'screen_view',
        screen,
        tenantId: this.tenantId,
        driverId: this.driverId,
        platform: Platform.OS,
        details: extra,
      }).catch(() => {});
    } catch {
      // Ignored: telemetry must never crash the app
    }
  }

  /**
   * Track high-impact UI user action (button click, modal open, form submit).
   */
  public trackAction(action: string, screen: string, details?: Record<string, any>) {
    try {
      api.post('/telemetry/event', {
        event: action,
        screen,
        tenantId: this.tenantId,
        driverId: this.driverId,
        platform: Platform.OS,
        details,
      }).catch(() => {});
    } catch {
      // Ignored
    }
  }

  /**
   * Install global uncaught exception listener for React Native.
   */
  public initGlobalErrorHandler() {
    const g = globalThis as any;
    const defaultHandler = g.ErrorUtils?.getGlobalHandler?.();

    if (g.ErrorUtils) {
      g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        this.reportError({
          message: `[Fatal: ${Boolean(isFatal)}] ${error?.message || 'Unhandled error'}`,
          error,
          screen: 'global_uncaught',
        });

        // Delegate to original handler so dev redbox/debugger continues to work
        if (defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
    }
  }
}

export const telemetry = new MobileTelemetry();
