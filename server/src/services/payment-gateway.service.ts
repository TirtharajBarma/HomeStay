// Razorpay Payment Links for the guest advance (no SDK). Off unless PAYMENT_GATEWAY_MODE=razorpay and
// the key id/secret are set; then a link is created when a trip starts waiting for its advance and the
// signed webhook (payment_link.paid) records the payment, so nobody has to type it in by hand.
// Never logs keys, phones or amounts per guest.
import crypto from 'node:crypto';

const API = 'https://api.razorpay.com/v1/payment_links';
const TIMEOUT_MS = 8000;

const configured = (value: string | undefined) => {
  const normalized = value?.trim() || '';
  return Boolean(normalized && !/^(none|disabled|replace-with-|your[-_])/i.test(normalized));
};

export const gatewayEnabled = () =>
  process.env.NODE_ENV !== 'test' &&
  process.env.PAYMENT_GATEWAY_MODE === 'razorpay' &&
  configured(process.env.RAZORPAY_KEY_ID) &&
  configured(process.env.RAZORPAY_KEY_SECRET) &&
  configured(process.env.RAZORPAY_WEBHOOK_SECRET);

export interface PaymentLinkInput {
  amountRupees: number;
  reference: string; // cab request reference
  guestName: string;
  guestPhone: string;
  description: string;
  expiresAt: Date | null;
}

/** Creates a payment link; null when the gateway is off or Razorpay refused (the caller falls back). */
export async function createPaymentLink(input: PaymentLinkInput): Promise<{ id: string; url: string } | null> {
  if (!gatewayEnabled()) return null;
  const digits = input.guestPhone.replace(/\D/g, '');
  const body: Record<string, any> = {
    amount: Math.round(input.amountRupees * 100), // paise
    currency: 'INR',
    accept_partial: false,
    description: input.description.slice(0, 2048),
    // reference_id must be unique per link: a released and re-confirmed trip needs a fresh one
    reference_id: `${input.reference}-${Date.now().toString(36)}`.slice(0, 40),
    customer: { name: input.guestName.slice(0, 100), ...(digits.length >= 10 ? { contact: `+${digits.length === 10 ? '91' + digits : digits}` } : {}) },
    notify: { sms: false, email: false }, // StayRide sends the link on WhatsApp itself
    reminder_enable: false,
    notes: { reference: input.reference },
  };
  // Razorpay needs expiry at least 15 minutes ahead; shorter windows rely on our own release instead.
  if (input.expiresAt && input.expiresAt.getTime() - Date.now() > 16 * 60000) body.expire_by = Math.floor(input.expiresAt.getTime() / 1000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.id || !json?.short_url) {
      console.warn(`[payments] payment link failed (HTTP ${res.status})`);
      return null;
    }
    return { id: String(json.id), url: String(json.short_url) };
  } catch {
    console.warn('[payments] payment link failed (network)');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** X-Razorpay-Signature = hex HMAC-SHA256 of the raw request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: unknown, secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''): boolean {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature.toLowerCase(), 'hex'));
}
