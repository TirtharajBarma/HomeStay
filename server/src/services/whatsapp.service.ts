// WhatsApp Business messages from the company number (Meta Cloud API, no SDK).
// Best effort: never throws, never logs phone numbers or message text. Callers await it inside the
// request (Vercel may freeze the function after the response), so the call is bounded by a timeout.
//
// Off by default: set WHATSAPP_DISPATCH_MODE=cloud_api plus WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_ACCESS_TOKEN to send. Until then every send is skipped (and counted in the log line).
//
// Business-initiated messages must use a Meta-approved template. Set WHATSAPP_TPL_<EVENT> to the
// approved template name (e.g. WHATSAPP_TPL_ASK_CAB) and its body variables {{1}}, {{2}}... are filled
// from `params` in order. Without a template name the plain `text` is sent, which Meta delivers only
// inside the 24-hour reply window (fine for testing with the free test number).
import { logger } from '../utils/logger.js';

const TIMEOUT_MS = 4000;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

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
  | 'DRIVER_WELCOME';

export interface WhatsAppMessage {
  event: WhatsAppEvent;
  to: string;
  /** Template variables, in {{1}}, {{2}}... order */
  params: string[];
  /** Plain-text version of the same message */
  text: string;
}

export type WhatsAppResult = 'SENT' | 'SKIPPED' | 'FAILED';

const enabled = () =>
  process.env.NODE_ENV !== 'test' &&
  (process.env.WHATSAPP_DISPATCH_MODE === 'cloud_api' || process.env.WHATSAPP_DISPATCH_MODE === 'meta_cloud_api') &&
  Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

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

  // If unconfigured or demo, log the simulated message so developers can see it in Axiom and console!
  if (isDemo || !to || !isMetaEnabled) {
    const reason = isDemo ? 'DEMO_TENANT' : !to ? 'INVALID_PHONE' : 'META_API_NOT_CONFIGURED';
    console.log(`[whatsapp:simulated] event=${msg.event} to=${to || msg.to} reason=${reason} text="${msg.text.slice(0, 90)}..."`);
    logger.info(`[WhatsApp Simulated] ${msg.event} to ${to || msg.to} (${reason})`, {
      action: 'whatsapp.dispatch',
      metadata: {
        event: msg.event,
        to: to || msg.to,
        status: 'SKIPPED',
        reason,
        previewText: msg.text.slice(0, 160),
        params: msg.params,
        metaCloudApiEnabled: isMetaEnabled,
      },
    });
    return 'SKIPPED';
  }

  const template = templateName || process.env[`WHATSAPP_TPL_${msg.event}`];
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
      logger.warn(`[WhatsApp Failed] ${msg.event} to ${to} (HTTP ${res.status})`, {
        action: 'whatsapp.dispatch',
        metadata: { event: msg.event, to, status: 'FAILED', httpStatus: res.status },
      });
      return 'FAILED';
    }
    console.log(`[whatsapp:sent] event=${msg.event} to=${to}`);
    logger.info(`[WhatsApp Sent] ${msg.event} to ${to}`, {
      action: 'whatsapp.dispatch',
      metadata: { event: msg.event, to, status: 'SENT' },
    });
    return 'SENT';
  } catch (err: any) {
    console.warn(`[whatsapp] ${msg.event} failed (network: ${err?.message})`);
    logger.error(`[WhatsApp Error] ${msg.event} to ${to}`, {
      action: 'whatsapp.dispatch',
      error: { message: err?.message || 'Network error' },
      metadata: { event: msg.event, to, status: 'FAILED' },
    });
    return 'FAILED';
  } finally {
    clearTimeout(timer);
  }
}
