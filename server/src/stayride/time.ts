/** "hh:mm AM" → minutes after midnight, or null when it is not a valid 12-hour time. */
export function parseTime12(t: unknown): number | null {
  const m = typeof t === 'string' ? t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i) : null;
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  return ((h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + min;
}
