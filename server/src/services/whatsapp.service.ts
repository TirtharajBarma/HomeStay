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
  | 'BIDDING_TIMEOUT_OWNER';

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

// templateName: from the admin's settings; the WHATSAPP_TPL_<EVENT> env var is the older fallback
export async function sendWhatsApp(isDemo: boolean, msg: WhatsAppMessage, language = 'en', templateName?: string): Promise<WhatsAppResult> {
  const to = toWhatsAppNumber(msg.to);
  // Demo tenants never message real phones.
  if (isDemo || !to || !enabled()) return 'SKIPPED';

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
      return 'FAILED';
    }
    return 'SENT';
  } catch {
    console.warn(`[whatsapp] ${msg.event} failed (network)`);
    return 'FAILED';
  } finally {
    clearTimeout(timer);
  }
}
