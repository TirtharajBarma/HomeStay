// WhatsApp Business messages from the company number (Meta Cloud API, no SDK).
// Best effort: never throws, never logs phone numbers or message text. Callers await it inside the
// request (Vercel may freeze the function after the response), so the call is bounded by a timeout.
//
// Off by default: set WHATSAPP_DISPATCH_MODE=cloud_api plus WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_ACCESS_TOKEN to send. Until then every send is skipped (and counted in the log line).
//
// Business-initiated messages must use a Meta-approved template. Set WHATSAPP_TPL_<EVENT> to the
// approved template name (e.g. WHATSAPP_TPL_ASK_CAB) and its body variables {{1}}, {{2}}... are filled
// from `params` in order. Production sends require an approved template for every event.
import { logger } from '../utils/logger.js';

const TIMEOUT_MS = 4000;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v26.0';

export type WhatsAppEvent =
  | 'ASK_CAB'
  | 'NEW_REQUEST'
  | 'QUOTE_ACCEPTED_DRIVER'
  | 'QUOTE_ACCEPTED_GUEST'
  | 'ADVANCE_PAID_GUEST'
  | 'ADVANCE_PAID_DRIVER'
  | 'ADVANCE_EXPIRED_GUEST'
  | 'QUOTE_COUNTER'
  | 'TRIP_ASSIGNED_DRIVER'
  | 'TRIP_CANCELLED_GUEST'
  | 'REFUND_GUEST'
  | 'COMPLETION_REMINDER_DRIVER'
  | 'BIDDING_TIMEOUT_OWNER'
  | 'DRIVER_WELCOME'
  | 'PAYOUT_SETTLED_DRIVER'
  | 'PAYOUT_REJECTED_DRIVER'
  | 'VEHICLE_UPDATED_GUEST';

export interface WhatsAppMessage {
  event: WhatsAppEvent;
  to: string;
  /** Template variables, in {{1}}, {{2}}... order */
  params: string[];
  /** Plain-text version of the same message */
  text: string;
}

export type WhatsAppResult = 'SENT' | 'SKIPPED' | 'FAILED';

const configured = (value: string | undefined) => {
  const normalized = value?.trim() || '';
  return Boolean(normalized && !/^(none|disabled|replace-with-|your[-_])/i.test(normalized));
};

const enabled = () =>
  process.env.NODE_ENV !== 'test' &&
  (process.env.WHATSAPP_DISPATCH_MODE === 'cloud_api' || process.env.WHATSAPP_DISPATCH_MODE === 'meta_cloud_api') &&
  configured(process.env.WHATSAPP_PHONE_NUMBER_ID) &&
  configured(process.env.WHATSAPP_ACCESS_TOKEN);

/** Digits only with country code; a bare 10-digit Indian number gets 91. null when it cannot be a phone. */
export function toWhatsAppNumber(phone: unknown): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const full = digits.length === 10 ? `91${digits}` : digits;
  return /^\d{11,15}$/.test(full) ? full : null;
}

/** Pre-filled native wa.me link for manual dispatch fallback when Cloud API is unconfigured */
export function getWhatsAppNativeLink(phone: unknown, text: string): string {
  const to = toWhatsAppNumber(phone);
  if (!to) return '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// templateName: from the admin's settings; the WHATSAPP_TPL_<EVENT> env var is the older fallback
export async function sendWhatsApp(isDemo: boolean, msg: WhatsAppMessage, language = 'en', templateName?: string): Promise<WhatsAppResult> {
  const to = toWhatsAppNumber(msg.to);
  const isMetaEnabled = enabled();

  // Skips are logged without guest phone numbers or message contents.
  if (isDemo || !to || !isMetaEnabled) {
    const reason = isDemo ? 'DEMO_TENANT' : !to ? 'INVALID_PHONE' : 'META_API_NOT_CONFIGURED';
    logger.info(`[WhatsApp Skipped] ${msg.event} (${reason})`, {
      action: 'whatsapp.dispatch',
      metadata: {
        event: msg.event,
        status: 'SKIPPED',
        reason,
        metaCloudApiEnabled: isMetaEnabled,
      },
    });
    return 'SKIPPED';
  }

  const template = templateName || process.env[`WHATSAPP_TPL_${msg.event}`];
  if (!template && process.env.NODE_ENV === 'production') {
    logger.warn(`[WhatsApp Skipped] ${msg.event} (APPROVED_TEMPLATE_NOT_CONFIGURED)`, {
      action: 'whatsapp.dispatch',
      metadata: { event: msg.event, status: 'SKIPPED', reason: 'APPROVED_TEMPLATE_NOT_CONFIGURED' },
    });
    return 'SKIPPED';
  }
  const body = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: [{ type: 'body', parameters: msg.params.map((text) => ({ type: 'text', text })) }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: msg.text, preview_url: true } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[whatsapp] ${msg.event} failed (HTTP ${res.status})`);
      logger.warn(`[WhatsApp Failed] ${msg.event} (HTTP ${res.status})`, {
        action: 'whatsapp.dispatch',
        metadata: { event: msg.event, status: 'FAILED', httpStatus: res.status },
      });
      return 'FAILED';
    }
    logger.info(`[WhatsApp Sent] ${msg.event}`, {
      action: 'whatsapp.dispatch',
      metadata: { event: msg.event, status: 'SENT' },
    });
    return 'SENT';
  } catch (err: any) {
    console.warn(`[whatsapp] ${msg.event} failed (network)`);
    logger.error(`[WhatsApp Error] ${msg.event}`, {
      action: 'whatsapp.dispatch',
      error: { message: 'Network error' },
      metadata: { event: msg.event, status: 'FAILED' },
    });
    return 'FAILED';
  } finally {
    clearTimeout(timer);
  }
}
