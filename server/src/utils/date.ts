/**
 * Indian Standard Time (IST) Date Utilities
 * Ensures dates and timestamps saved in MongoDB represent IST (Asia/Kolkata, UTC+05:30)
 */

export function getISTTimestamp(date: Date = new Date()): string {
  try {
    return (
      // sv-SE gives sortable "YYYY-MM-DD HH:mm:ss"
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date) + ' IST'
    );
  } catch {
    // Fallback if Intl timeZone fails
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(date.getTime() + istOffset);
    return istTime.toISOString().replace('Z', '+05:30 (IST)');
  }
}

export function formatISTDateOnly(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
