/**
 * Utility functions for currency and date formatting across StayRide Expo app.
 */

export function formatINR(amount?: number | null, fallback: string = '₹0'): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return fallback;
  }
  return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
}

export function formatDate(timestampOrDate?: number | string | Date | null): string {
  if (!timestampOrDate) return '';
  const d = new Date(timestampOrDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
