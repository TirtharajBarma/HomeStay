// WhatsApp Business messages from the company number (Meta Cloud API, no SDK).
// Best effort: never throws, never logs full phone numbers (last 4 only) or message text. Callers await it inside the
// request (Vercel may freeze the function after the response), so the call is bounded by a timeout.
//
// Off by default: set WHATSAPP_DISPATCH_MODE=cloud_api plus WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_ACCESS_TOKEN to send. Until then every send is skipped (and counted in the log line).
//
// Business-initiated messages must use a Meta-approved template. Set WHATSAPP_TPL_<EVENT> to the
// approved template name (e.g. WHATSAPP_TPL_ASK_CAB) and its body variables {{1}}, {{2}}... are filled
// from `params` in order. Production sends require an approved template for every event.
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';
import { audit } from '../models/audit-log.model.js';

const TIMEOUT_MS = 4000;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v26.0';

export type WhatsAppEvent =
  | 'ASK_CAB'
  | 'NEW_REQUEST'
  | 'QUOTE_ACCEPTED_DRIVER'
  | 'QUOTE_ACCEPTED_GUEST'
  | 'ADVANCE_PAID_GUEST'
  | 'BOARDING_PIN_GUEST'
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
  /** Who/what the message is about: logged, and echoed back by Meta in status webhooks */
  context?: WhatsAppContext;
}

export interface WhatsAppContext {
  ref?: string; // cab request reference
  tenantId?: string;
  driverId?: string;
}

/** Phone shown in logs and before contact is released: digits only, last 4 kept (works with spaces / +91). */
export const maskPhone = (p: unknown) => {
  const digits = String(p ?? '').replace(/\D/g, '');
  return digits ? `******${digits.slice(-4)}` : '';
};

/** biz_opaque_callback_data (Meta max 512 chars): short keys, each value capped so the JSON always fits. */
export function opaqueData(event: string, ctx: WhatsAppContext = {}): string {
  const cut = (v: unknown) => (v ? String(v).slice(0, 120) : undefined);
  return JSON.stringify({ e: cut(event), r: cut(ctx.ref), t: cut(ctx.tenantId), d: cut(ctx.driverId) });
}

/** Reverse of opaqueData; {} for anything that isn't ours. */
export function readOpaqueData(raw: unknown): { event?: string; ref?: string; tenantId?: string; driverId?: string } {
  try {
    const o = JSON.parse(String(raw));
    return o && typeof o === 'object' ? { event: o.e, ref: o.r, tenantId: o.t, driverId: o.d } : {};
  } catch {
    return {};
  }
}

/** Meta webhook verification (GET): the challenge to echo back, or null (answer 403). */
export function verifyHandshake(query: Record<string, unknown>, token = process.env.WHATSAPP_VERIFY_TOKEN || ''): string | null {
  const given = String(query['hub.verify_token'] ?? '');
  if (!configured(token) || query['hub.mode'] !== 'subscribe' || given.length !== token.length) return null;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token)) ? String(query['hub.challenge'] ?? '') : null;
}

/** X-Hub-Signature-256 = "sha256=" + hex HMAC-SHA256 of the raw body, keyed with the Meta app secret. */
export function verifyMetaSignature(rawBody: Buffer | string, header: unknown, secret = process.env.WHATSAPP_APP_SECRET || ''): boolean {
  if (!configured(secret) || typeof header !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(header.slice(7), 'hex'));
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
  // leading 0 (trunk) / 00 (international) prefixes: no country code starts with 0
  const digits = String(phone ?? '').replace(/\D/g, '').replace(/^0+/, '');
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

  const ctx = msg.context || {};
  const base = { event: msg.event, to: maskPhone(msg.to), ...ctx };
  const logMeta = { action: 'whatsapp.dispatch', tenantId: ctx.tenantId, driverId: ctx.driverId };

  // Skips go to Axiom only, never with message contents.
  if (isDemo || !to || !isMetaEnabled) {
    const reason = isDemo ? 'DEMO_TENANT' : !to ? 'INVALID_PHONE' : 'META_API_NOT_CONFIGURED';
    logger.info(`[WhatsApp Skipped] ${msg.event} (${reason})`, {
      ...logMeta,
      metadata: { ...base, status: 'SKIPPED', reason, metaCloudApiEnabled: isMetaEnabled },
    });
    return 'SKIPPED';
  }

  const template = templateName || process.env[`WHATSAPP_TPL_${msg.event}`];
  if (!template && process.env.NODE_ENV === 'production') {
    logger.warn(`[WhatsApp Skipped] ${msg.event} (APPROVED_TEMPLATE_NOT_CONFIGURED)`, {
      ...logMeta,
      metadata: { ...base, status: 'SKIPPED', reason: 'APPROVED_TEMPLATE_NOT_CONFIGURED' },
    });
    return 'SKIPPED';
  }
  // Meta echoes this back on every status webhook, so the send needs no Mongo record of its own.
  const biz_opaque_callback_data = opaqueData(msg.event, ctx);
  const body = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        biz_opaque_callback_data,
        template: {
          name: template,
          language: { code: language },
          // Meta rejects the whole send when any template variable is empty
          components: [
            { type: 'body', parameters: msg.params.map((text) => ({ type: 'text', text: String(text ?? '').trim() || '-' })) },
            // authentication templates also take the code for their copy-code button
            ...(msg.event === 'BOARDING_PIN_GUEST' ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: msg.params[0] }] }] : []),
          ],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', biz_opaque_callback_data, text: { body: msg.text, preview_url: true } };

  const failed = async (detail: Record<string, any>) => {
    logger.warn(`[WhatsApp Failed] ${msg.event} (${detail.code ?? detail.httpStatus ?? 'network'})`, {
      ...logMeta,
      metadata: { ...base, template, status: 'FAILED', ...detail },
    });
    // compact Mongo record (90-day TTL); Axiom above has the full error
    await audit('system', 'whatsapp.failed', 'cab_request', ctx.ref || '', { event: msg.event, to: base.to, code: detail.code ?? detail.httpStatus ?? 'NETWORK', title: detail.title || '' }, false, { tenantId: ctx.tenantId, driverId: ctx.driverId, actorRole: 'SYSTEM' });
    return 'FAILED' as const;
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      const e = json?.error || {};
      return await failed({ httpStatus: res.status, code: e.code, subcode: e.error_subcode, title: e.error_user_title || e.title || e.type, message: e.message, error_data: e.error_data, fbtraceId: e.fbtrace_id });
    }
    logger.info(`[WhatsApp Sent] ${msg.event}`, {
      ...logMeta,
      metadata: { ...base, template: template || null, status: 'SENT', messageId: json?.messages?.[0]?.id, messageStatus: json?.messages?.[0]?.message_status },
    });
    return 'SENT';
  } catch (err: any) {
    return await failed({ title: err?.name === 'AbortError' ? 'Timeout' : 'Network error', message: err?.message });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Signed Meta webhook payload (production only): every delivery status and inbound message goes to Axiom;
 * failed deliveries and replies also get a compact Mongo audit entry (90-day TTL). Phones are masked.
 * ponytail: replies aren't linked to a trip (phones are stored unnormalised, so no cheap indexed lookup);
 * Axiom joins them through replyTo = the wamid of our message, which the send log carries as messageId.
 */
export async function recordWhatsAppWebhook(body: any): Promise<void> {
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const v = change?.value || {};
      for (const st of v.statuses || []) {
        const ctx = readOpaqueData(st.biz_opaque_callback_data);
        const err = st.errors?.[0];
        const to = maskPhone(st.recipient_id);
        const failed = st.status === 'failed';
        logger[failed ? 'warn' : 'info'](`[WhatsApp Status] ${ctx.event || 'UNKNOWN'} ${st.status}`, {
          action: 'whatsapp.status',
          tenantId: ctx.tenantId,
          driverId: ctx.driverId,
          metadata: {
            ...ctx, to, status: st.status, messageId: st.id, timestamp: st.timestamp,
            conversationId: st.conversation?.id, conversationType: st.conversation?.origin?.type,
            pricingCategory: st.pricing?.category, billable: st.pricing?.billable, errors: st.errors,
          },
        });
        if (failed) {
          await audit('meta', 'whatsapp.failed', 'cab_request', ctx.ref || '', { event: ctx.event || '', to, code: err?.code, title: err?.title || '', reason: String(err?.error_data?.details || err?.message || '').slice(0, 300) }, false, { tenantId: ctx.tenantId, driverId: ctx.driverId, actorRole: 'SYSTEM' });
        }
      }
      for (const m of v.messages || []) {
        const from = maskPhone(m.from);
        const text = String(m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? m.reaction?.emoji ?? '');
        logger.info(`[WhatsApp Reply] ${m.type} from ${from}`, {
          action: 'whatsapp.reply',
          metadata: { ...m, from, replyTo: m.context?.id, text },
        });
        await audit(`whatsapp:${from}`, 'whatsapp.reply', 'whatsapp_sender', from, { from, type: m.type, text: text.slice(0, 300), replyTo: m.context?.id || '' }, false);
      }
      if (v.errors || (!v.statuses && !v.messages)) {
        logger.info(`[WhatsApp Webhook] ${change?.field || 'unknown'}`, { action: 'whatsapp.webhook', metadata: { field: change?.field, errors: v.errors, event: v.event, messageTemplateName: v.message_template_name, reason: v.reason } });
      }
    }
  }
}
