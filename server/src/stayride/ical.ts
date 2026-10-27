// Room calendars shared with Airbnb, Booking.com and other sites (iCal).
// Export: each room has a secret link those sites read to block dates booked here.
// Import: the owner pastes those sites' calendar links; their bookings become date blocks here, a
// booking that disappears from the feed (cancelled there) frees the dates, and any overlap with an
// existing booking is flagged as a possible double booking.
import crypto from 'node:crypto';
import { getIcalFeedModel } from '../models/ical-feed.model.js';
import { CommissionService } from '../services/commission.service.js';
import { tenantManager, StayRideMemoryStore, StayRideBooking, bookingClash, istDayStart } from './store.js';
import { httpError } from '../middlewares/error-handler.js';
import { config } from '../config/env.js';

const IST_OFFSET = 330 * 60000;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_IMPORTS = 3;

export interface IcalEvent {
  uid: string;
  start: number; // IST local-midnight ms, like booking dates
  end: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Parsing and building
// ---------------------------------------------------------------------------
/** "20261020" or "20261020T140000Z" → IST day start (ms). */
function icsDate(value: string): number | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (!hh) return Date.UTC(+y, +mo - 1, +d) - IST_OFFSET; // all-day date: that calendar day in IST
  const utc = Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss) - (z ? 0 : IST_OFFSET); // floating time read as IST
  return istDayStart(utc);
}

export function parseIcs(text: string): IcalEvent[] {
  // Unfold continuation lines (RFC 5545: a line starting with space/tab continues the previous one)
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r\n|\n|\r/);
  const events: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') cur = { uid: '', summary: '' };
    else if (line === 'END:VEVENT') {
      if (cur?.uid && typeof cur.start === 'number') {
        const end = typeof cur.end === 'number' && cur.end > cur.start ? cur.end : cur.start + 86400000;
        events.push({ uid: cur.uid, start: cur.start, end, summary: cur.summary || '' });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(';')[0].toUpperCase();
      const value = line.slice(idx + 1).trim();
      if (key === 'UID') cur.uid = value.slice(0, 200);
      else if (key === 'SUMMARY') cur.summary = value.replace(/\\[,;n]/g, ' ').slice(0, 100);
      else if (key === 'DTSTART') cur.start = icsDate(value) ?? undefined;
      else if (key === 'DTEND') cur.end = icsDate(value) ?? undefined;
    }
  }
  return events;
}

const ymd = (ms: number) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10).replace(/-/g, '');

/** Busy dates of one room, as an iCal feed other sites can read. No guest names or phones. */
export function buildIcs(store: StayRideMemoryStore, roomId: number): string {
  const room = store.room(roomId);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Platform//Room Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (room) {
    out.push(`X-WR-CALNAME:${(store.homestay.name || 'Homestay').replace(/[,;\n]/g, ' ')} - Room ${room.number}`);
    const from = istDayStart(Date.now()) - 86400000;
    for (const b of store.bookings) {
      if (b.roomNumber !== room.number || b.checkOut <= from) continue;
      if (b.status !== 'CONFIRMED' && b.status !== 'CHECKED_IN') continue;
      out.push('BEGIN:VEVENT', `UID:stayride-${roomId}-${b.id}@stayride`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(b.checkIn)}`, `DTEND;VALUE=DATE:${ymd(b.checkOut)}`, 'SUMMARY:Not available', 'END:VEVENT');
    }
    if (room.status === 'MAINTENANCE') {
      const today = istDayStart(Date.now());
      out.push('BEGIN:VEVENT', `UID:stayride-${roomId}-maintenance@stayride`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(today)}`, `DTEND;VALUE=DATE:${ymd(today + 86400000)}`, 'SUMMARY:Not available', 'END:VEVENT');
    }
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Fetching OTA calendars safely
// ---------------------------------------------------------------------------
const hostAllowed = (host: string, allowed: string[]) => allowed.some((a) => host === a || host.endsWith(`.${a}`));

/** Throws a 400 explaining why a calendar link is not accepted. */
export function checkIcalUrl(raw: string, allowed: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw httpError(400, 'That is not a valid link.');
  }
  if (url.protocol !== 'https:') throw httpError(400, 'Calendar links must start with https://');
  if (url.username || url.password || (url.port && url.port !== '443')) throw httpError(400, 'That calendar link is not allowed.');
  if (!hostAllowed(url.hostname.toLowerCase(), allowed)) {
    throw httpError(400, `Calendar links from ${url.hostname} are not supported. Use the export link from Airbnb, Booking.com or another listed site.`);
  }
  return url;
}

export function sourceName(host: string): string {
  const h = host.toLowerCase();
  if (h.includes('airbnb')) return 'Airbnb';
  if (h.includes('booking.com')) return 'Booking.com';
  if (h.includes('vrbo')) return 'Vrbo';
  if (h.includes('expedia')) return 'Expedia';
  if (h.includes('agoda')) return 'Agoda';
  if (h.includes('makemytrip')) return 'MakeMyTrip';
  if (h.includes('goibibo')) return 'Goibibo';
  if (h.includes('google')) return 'Google Calendar';
  return h.replace(/^www\./, '');
}

/** GET an allowed calendar link: https only, every redirect re-checked, size and time bounded. */
export async function fetchIcs(raw: string, allowed: string[]): Promise<string> {
  let url = checkIcalUrl(raw, allowed);
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/calendar, text/plain, */*' } });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location');
        if (!next) throw new Error('The calendar site sent an empty redirect.');
        url = checkIcalUrl(new URL(next, url).toString(), allowed); // a redirect may not leave the allowed sites
        continue;
      }
      if (!res.ok) throw new Error(`The calendar site answered ${res.status}.`);
      const reader = res.body?.getReader();
      if (!reader) return '';
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error('The calendar is too large.');
        }
        chunks.push(value);
      }
      const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link did not return a calendar.');
      return text;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('The calendar site took too long to answer.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects.');
}

// ---------------------------------------------------------------------------
// Applying an OTA feed to a room
// ---------------------------------------------------------------------------
/**
 * Make the room's imported blocks from one feed match the feed. Returns what changed. Only future
 * stays are touched: past imported stays stay as history.
 */
export function applyFeed(store: StayRideMemoryStore, roomNumber: string, feedId: string, source: string, events: IcalEvent[], now = Date.now()) {
  const today = istDayStart(now);
  const mine = store.bookings.filter((b) => b.external?.feedId === feedId && b.roomNumber === roomNumber);
  const byUid = new Map(mine.map((b) => [b.external!.uid, b]));
  const seen = new Set<string>();
  let added = 0, updated = 0, cancelled = 0;
  for (const ev of events) {
    if (ev.end <= today) continue;
    seen.add(ev.uid);
    const existing = byUid.get(ev.uid);
    if (existing) {
      if (existing.status === 'CONFIRMED' && (existing.checkIn !== ev.start || existing.checkOut !== ev.end)) {
        existing.checkIn = ev.start;
        existing.checkOut = ev.end;
        updated++;
      }
      if (existing.status === 'CANCELLED') {
        existing.status = 'CONFIRMED'; // back on the OTA calendar
        updated++;
      }
      continue;
    }
    store.bookings.unshift({
      id: store.nextBookingIdForImport(),
      guestId: 0,
      guestName: `${source} booking`,
      phone: '',
      checkIn: ev.start,
      checkOut: ev.end,
      roomNumber,
      guests: 1,
      status: 'CONFIRMED',
      paid: false,
      amount: 0,
      source,
      external: { source, uid: ev.uid, feedId },
    } as StayRideBooking);
    added++;
  }
  for (const b of mine) {
    if (!seen.has(b.external!.uid) && b.status === 'CONFIRMED' && b.checkOut > today) {
      b.status = 'CANCELLED'; // gone from the OTA calendar: cancelled there
      cancelled++;
    }
  }
  // Flag overlaps between imported blocks and any other booking in this room (possible double booking)
  let conflicts = 0;
  for (const b of store.bookings) {
    if (b.external?.feedId !== feedId || b.roomNumber !== roomNumber) continue;
    const clash = b.status === 'CONFIRMED' ? bookingClash(store.bookings, roomNumber, b.checkIn, b.checkOut, b.id, now) : undefined;
    b.external.conflict = Boolean(clash);
    if (clash) conflicts++;
  }
  return { added, updated, cancelled, conflicts };
}

// ---------------------------------------------------------------------------
// Feeds per room (owner settings) and syncing
// ---------------------------------------------------------------------------
export async function feedFor(tenantKey: string, isDemo: boolean, roomId: number, create = true) {
  const Feeds = getIcalFeedModel(isDemo);
  const existing = await Feeds.findOne({ tenantKey, roomId }).lean();
  if (existing || !create) return existing as any;
  try {
    return (await Feeds.create({ tenantKey, roomId, exportToken: crypto.randomBytes(24).toString('base64url'), imports: [] })).toObject();
  } catch (err: any) {
    if (err?.code === 11000) return (await Feeds.findOne({ tenantKey, roomId }).lean()) as any; // created in parallel
    throw err;
  }
}

export async function setImports(tenantKey: string, isDemo: boolean, roomId: number, urls: unknown) {
  const list = Array.isArray(urls) ? urls.map((u) => String(u ?? '').trim()).filter(Boolean) : [];
  if (list.length > MAX_IMPORTS) throw httpError(400, `At most ${MAX_IMPORTS} calendar links per room.`);
  const cfg = await CommissionService.getPlatformConfig(isDemo);
  const checked = list.map((u) => checkIcalUrl(u, cfg.icalAllowedHosts));
  const feed = await feedFor(tenantKey, isDemo, roomId);
  const keep = new Map((feed.imports || []).map((i: any) => [i.url, i]));
  const imports = checked.map((u) => {
    const url = u.toString();
    return (keep.get(url) as any) || { id: crypto.randomBytes(6).toString('hex'), url, source: sourceName(u.hostname), lastSyncAt: null, lastError: '', eventCount: 0 };
  });
  const removedIds = (feed.imports || []).filter((i: any) => !imports.some((n: any) => n.id === i.id)).map((i: any) => i.id);
  await getIcalFeedModel(isDemo).updateOne({ _id: feed._id }, { $set: { imports } });
  // Blocks from a removed link are cancelled (future only): the owner stopped syncing that site
  if (removedIds.length) {
    const room = (await tenantManager.load(tenantKey)).room(roomId);
    if (room) {
      await tenantManager.mutate(tenantKey, (s) => {
        for (const id of removedIds) applyFeed(s, room.number, id, '', []);
      });
    }
  }
  return { ...feed, imports };
}

/** Pull every import link of one room and apply it. Errors are stored per link, never thrown. */
export async function syncRoom(tenantKey: string, isDemo: boolean, roomId: number) {
  const feed = await feedFor(tenantKey, isDemo, roomId, false);
  if (!feed?.imports?.length) return { feed, results: [] as any[] };
  const room = (await tenantManager.load(tenantKey)).room(roomId);
  if (!room) return { feed, results: [] as any[] };
  const cfg = await CommissionService.getPlatformConfig(isDemo);
  const results: any[] = [];
  const imports = [];
  for (const imp of feed.imports) {
    try {
      const events = parseIcs(await fetchIcs(imp.url, cfg.icalAllowedHosts));
      const r = await tenantManager.mutate(tenantKey, (s) => applyFeed(s, room.number, imp.id, imp.source, events));
      imports.push({ ...imp, lastSyncAt: new Date(), lastError: '', eventCount: events.length });
      results.push({ source: imp.source, ok: true, ...r });
    } catch (err: any) {
      imports.push({ ...imp, lastSyncAt: new Date(), lastError: String(err?.message || 'Sync failed').slice(0, 200) });
      results.push({ source: imp.source, ok: false, error: err?.message || 'Sync failed' });
    }
  }
  await getIcalFeedModel(isDemo).updateOne({ _id: feed._id }, { $set: { imports } });
  return { feed: { ...feed, imports }, results };
}

/** Scheduled sync of every room that imports calendars (oldest first, bounded per run). */
export async function syncAll(isDemo: boolean, limit = 25) {
  const feeds: any[] = await getIcalFeedModel(isDemo).find({ 'imports.0': { $exists: true } }).sort({ updatedAt: 1 }).limit(limit).lean();
  let rooms = 0;
  for (const f of feeds) {
    await syncRoom(f.tenantKey, isDemo, f.roomId);
    rooms++;
  }
  return { rooms };
}

export async function storeForExportToken(token: string) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 80) return null;
  for (const isDemo of [false, true]) {
    if (isDemo && !config.demoEnabled) break;
    const feed: any = await getIcalFeedModel(isDemo).findOne({ exportToken: token }).lean();
    if (feed) return { feed, store: await tenantManager.load(feed.tenantKey) };
  }
  return null;
}
