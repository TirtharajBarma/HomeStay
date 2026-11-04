// One upi:// payment link (NPCI UPI deep-link spec) for the "Pay with UPI app" button and the QR code.
// encodeURIComponent, not URLSearchParams: some UPI apps show a "+" from form encoding literally in names and notes.

export const UPI_NOTE_MAX = 50; // apps cut or reject longer notes (tn)
const VPA = /^[\w.-]{1,256}@[a-zA-Z][\w.-]{1,64}$/;

export type UpiPayment = { upiId: string; payee: string; amount: number; reference: string };

/** upi://pay link, or "" when the UPI ID or amount is unusable (the page then shows no UPI section). */
export function upiPayUrl({ upiId, payee, amount, reference }: UpiPayment): string {
  const pa = upiId.trim();
  if (!VPA.test(pa) || !Number.isFinite(amount) || amount <= 0) return "";
  const pn = payee.trim().slice(0, 50) || pa;
  const full = `${pn} ${reference} advance`;
  const tn = (full.length <= UPI_NOTE_MAX ? full : `${reference} advance`).slice(0, UPI_NOTE_MAX);
  const params: [string, string][] = [
    ["pa", pa],
    ["pn", pn],
    ["am", amount.toFixed(2)],
    ["cu", "INR"],
    ["tn", tn],
    ["tr", reference.slice(0, 35)],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** UPI transaction reference (UTR / RRN): 12 digits; spaces/dashes and prefixes stripped. */
export const cleanUtr = (v: string) => {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.length === 12 ? digits : String(v ?? "").replace(/[\s-]/g, "");
};
export const isUtr = (v: string) => /^\d{12}$/.test(cleanUtr(v));
