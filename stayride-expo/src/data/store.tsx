import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Room,
  Guest,
  Booking,
  Driver,
  CabTrip,
  Campaign,
  Homestay,
  UserSession,
  BookingStatus,
  RoomStatus,
  VehicleType,
  CommissionRates,
  AccountFeatures,
  FeatureKey,
  DriverTrip,
  PaymentMethod,
  RoomCalendar,
} from '../types';
import { generateSeedData, todayMidnight, DAY_MS } from './seeder';
import { api, ApiError, DEMO_ENABLED } from './api';
import { outbox, OutboxMethod } from './outbox';
import { registerForPush, unregisterPush } from '../services/push';
import { PlatformPublicConfig, getPlatformConfig, setPlatformConfig } from './platformConfig';
import { roomStatusOf } from '../utils/rooms';

export interface PayoutSummary {
  available: number;
  eligibleTrips: number;
  pendingPayout: { id: string; amount: number } | null;
}

// Result contract shared by every mutation action:
//  - ok + synced   → the server accepted it (server truth applied locally)
//  - not ok         → offline/5xx/4xx: nothing saved, change rolled back
//  - !ok           → a terminal 4xx, the optimistic change was rolled back
export interface ActionOutcome {
  ok: boolean;
  synced: boolean;
  queued?: boolean;
  error?: string;
}

// Union two row lists by id with LOCAL precedence: server rows are the base, local rows (which may
// hold pending optimistic edits or not-yet-synced creations) are overlaid. Used during a sync to
// protect entities that still have an outbox entry from being wiped by the server snapshot.
function mergePendingById<T extends { id: number | string }>(local: T[], server: T[]): T[] {
  const byId = new Map<number | string, T>();
  for (const row of server) byId.set(row.id, row);
  for (const row of local) byId.set(row.id, row);
  return Array.from(byId.values());
}

interface StayRideContextType {
  // State
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  drivers: Driver[];
  networkDrivers: Driver[];
  trips: CabTrip[];
  campaigns: Campaign[];
  homestay: Homestay;
  commissionRates: CommissionRates | null;
  // Admin feature switches from GET /snapshot; null until loaded (offline demo: all on)
  features: AccountFeatures | null;
  // Admin-controlled settings (times, booking window, presets, vehicles, fees) from the server
  config: PlatformPublicConfig;
  // Server message when the account is suspended (ACCOUNT_BLOCKED); UI shows a blocking screen
  accountBlock: string | null;
  // Trips as shown to a platform driver (driver role only)
  driverTrips: DriverTrip[];
  payoutSummary: PayoutSummary | null;
  // True once this device's push token reached the server (copy can promise notifications)
  pushEnabled: boolean;
  refreshPayoutSummary: () => Promise<PayoutSummary | null>;
  requestFeature: (featureKey: FeatureKey, reason: string) => Promise<ActionOutcome>;
  session: UserSession | null;
  loading: boolean;
  syncing: boolean;
  backendStatus: 'checking' | 'connected' | 'offline';
  // Number of local mutations still waiting to reach the server (offline queue depth)
  outboxCount: number;

  // Computed metrics
  todayBookings: () => Booking[];
  currentGuestCount: () => number;
  availableRoomCount: () => number;
  monthRevenue: () => number;
  occupancyPercent: () => number;
  commissionEarned: () => number;
  totalBookings: () => number;
  recentBookings: (limit?: number) => Booking[];
  upcomingCheckIns: (limit?: number) => Booking[];
  recentTrips: (limit?: number) => CabTrip[];
  countRooms: (status: RoomStatus | 'ALL') => number;
  countGuests: (isRepeat: boolean) => number;
  searchGuests: (query: string, filter: string, periodDays: number) => Guest[];

  // Time-series chart helpers
  getChartData: (metric: 'revenue' | 'bookings' | 'cabs' | 'commission', period: '7d' | '30d' | '6m' | '1y') => {
    labels: string[];
    values: number[];
  };

  // Actions
  sync: () => Promise<void>;
  createBooking: (data: Omit<Booking, 'id' | 'status'> & { paid?: boolean; advance?: number; advanceMethod?: PaymentMethod }) => Promise<Booking>;
  checkInBooking: (id: number) => Promise<ActionOutcome>;
  checkOutBooking: (id: number) => Promise<ActionOutcome>;
  cancelBooking: (id: number) => Promise<ActionOutcome>;
  setBookingPaid: (id: number, paid: boolean) => Promise<ActionOutcome>;
  /** Record money received for a stay (advance, part, balance). */
  addPayment: (id: number, payment: { amount: number; method: PaymentMethod; note?: string }) => Promise<ActionOutcome>;
  removePayment: (id: number, paymentId: number) => Promise<ActionOutcome>;
  /** Room calendar sync with Airbnb / Booking.com (online only). */
  getRoomCalendar: (roomId: number) => Promise<RoomCalendar>;
  setRoomCalendarLinks: (roomId: number, importUrls: string[]) => Promise<RoomCalendar>;
  syncRoomCalendar: (roomId: number) => Promise<RoomCalendar>;
  editBooking: (id: number, changes: { checkIn?: number; checkOut?: number; amount?: number; guests?: number }) => Promise<ActionOutcome>;
  changeBookingRoom: (id: number, roomNumber: string) => Promise<ActionOutcome>;

  createRoom: (data: Omit<Room, 'id'>) => Promise<Room>;
  updateRoom: (id: number, data: Partial<Room>) => Promise<ActionOutcome>;
  deleteRoom: (id: number) => Promise<ActionOutcome>;

  createGuest: (data: Omit<Guest, 'id' | 'visits' | 'totalSpending' | 'firstVisit' | 'lastVisit'>) => Promise<Guest>;
  updateGuest: (id: number, data: Partial<Guest>) => Promise<ActionOutcome>;
  deleteGuest: (id: number) => Promise<ActionOutcome>;

  createDriver: (data: Omit<Driver, 'id' | 'ownerDriver' | 'active'>) => Promise<Driver>;
  updateDriver: (id: number, data: Partial<Driver>) => Promise<ActionOutcome>;
  setDriverAvailability: (id: number, available: boolean) => Promise<ActionOutcome>;
  setDriverOnline: (available: boolean) => Promise<ActionOutcome>;
  setDriverActive: (id: number, active: boolean) => Promise<ActionOutcome>;
  deleteDriver: (id: number) => Promise<ActionOutcome>;

  createTrip: (
    data: Omit<CabTrip, 'id' | 'status' | 'driverId' | 'driverName' | 'ownerDriver' | 'fare' | 'commission' | 'commissionPaid' | 'estFare'> & {
      dispatchMode?: 'PLATFORM' | 'OWN_DRIVER';
    }
  ) => Promise<CabTrip>;
  /** Own driver takes the trip at the fare agreed with them; StayRide's own-fleet fee is the guest's advance. */
  assignTripDriver: (tripId: number, driverId: number, fare: number) => Promise<ActionOutcome>;
  /** Driver app: tell StayRide where the driver is, so nearby requests reach them. Best effort. */
  reportDriverLocation: (lat: number, lng: number) => Promise<void>;
  quoteTrip: (tripId: number, driverId: number, quotedFare: number) => Promise<ActionOutcome>;
  confirmTripQuote: (tripId: number, driverId: number | string) => Promise<ActionOutcome & { trip?: CabTrip }>;
  /** Owner counter-offers a driver's quote (StayRide trips). */
  counterOffer: (tripId: number, driverId: number | string, fare: number) => Promise<ActionOutcome>;
  /** Send a held guest inquiry to the nearby driver network. */
  dispatchTrip: (tripId: number) => Promise<ActionOutcome>;
  acceptTrip: (tripId: number) => Promise<ActionOutcome>;
  reassignTrip: (tripId: number) => Promise<ActionOutcome>;
  startTrip: (tripId: number) => Promise<ActionOutcome>;
  completeTrip: (tripId: number, finalFare?: number) => Promise<ActionOutcome>;
  cancelTrip: (tripId: number, reason?: string) => Promise<ActionOutcome>;
  rateTrip: (tripId: number, stars: number, comment?: string) => Promise<ActionOutcome>;
  driverQuote: (reference: string, quotedFare: number, notes?: string) => Promise<ActionOutcome>;
  driverStartTrip: (reference: string, otp?: string) => Promise<ActionOutcome>;
  /** Driver takes the homestay's counter-offer: the trip is confirmed at that fare. */
  driverAcceptCounter: (reference: string) => Promise<ActionOutcome>;
  driverCompleteTrip: (reference: string) => Promise<ActionOutcome>;
  bookDriver: (data: {
    guestName: string;
    phone: string;
    pickup: string;
    destination: string;
    date: number;
    time: string;
    passengers: number;
    vehicleType: VehicleType;
    pickupLat?: number;
    pickupLng?: number;
    driverId: number;
    fare: number;
    destinations?: CabTrip['destinations'];
    isRoundTrip?: boolean;
    returnDate?: number;
    returnTime?: string;
  }) => Promise<CabTrip>;

  createCampaign: (
    titleOrData: string | { title: string; message: string; audience: Campaign['audience']; recipients?: number },
    message?: string,
    audience?: Campaign['audience']
  ) => Promise<Campaign>;
  sendCampaign: (id: number) => Promise<ActionOutcome>;
  createGuestLink: (data: { guestId?: number; guestName: string; guestPhone: string }) => Promise<{ url: string; expiresAt: number }>;
  /** StayRide sends the cab-request link to the guest from the company WhatsApp number. */
  askGuestForCab: (data: { guestId?: number; guestName: string; guestPhone: string }) => Promise<{ sent: boolean; status: 'SENT' | 'SKIPPED'; nativeLink?: string; url?: string }>;

  updateHomestay: (data: Partial<Homestay>) => Promise<ActionOutcome>;
  /** Pin the homestay on the map (nearby drivers are matched from here). */
  setHomestayLocation: (loc: { latitude: number; longitude: number; address?: string }) => Promise<ActionOutcome>;
  isDemoMode: boolean;

  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  // POST /auth/logout-all, then sign out here. Stays signed in if the server call fails.
  logoutAllDevices: () => Promise<ActionOutcome>;
  syncClerkUser: (
    clerkUser: any,
    clerkToken: string,
    extras?: {
      homestayName?: string;
      location?: string;
      phone?: string;
      name?: string;
      email?: string;
      role?: 'owner' | 'driver' | 'admin';
      vehicleType?: string;
      vehicleNumber?: string;
      area?: string;
      latitude?: number;
      longitude?: number;
      mapQuery?: string;
      acceptedTerms?: boolean; // new accounts: Terms + Privacy accepted, 18+ confirmed
    }
  ) => Promise<void>;
}

const StayRideContext = createContext<StayRideContextType | null>(null);

export const StayRideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [session, setSession] = useState<UserSession | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  // What screens see: each room's status worked out from bookings (same rule as the server), so a
  // check-in or new booking shows at once and a future booking never marks a room busy today.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [networkDrivers, setNetworkDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<CabTrip[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [homestay, setHomestay] = useState<Homestay>({} as Homestay);
  const [commissionRates, setCommissionRates] = useState<CommissionRates | null>(null);
  const [features, setFeatures] = useState<AccountFeatures | null>(null);
  const [config, setConfig] = useState<PlatformPublicConfig>(getPlatformConfig());
  const roomsView = useMemo(
    () =>
      rooms.map((r) => {
        const next = bookings
          .filter((b) => b.roomNumber === r.number && b.status === 'CONFIRMED' && b.checkIn > clock)
          .reduce<number | null>((min, b) => (min === null || b.checkIn < min ? b.checkIn : min), null);
        return { ...r, status: roomStatusOf(r, bookings, clock), nextArrival: next };
      }),
    [rooms, bookings, clock]
  );

  const [accountBlock, setAccountBlock] = useState<string | null>(null);
  const [driverTrips, setDriverTrips] = useState<DriverTrip[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const pushTriedRef = useRef(false);
  const [nextIds, setNextIds] = useState({ room: 10, guest: 20, booking: 100, driver: 20, trip: 20, campaign: 10 });

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);

  // Refs so async code (persist, sync, timers) never reads a stale session from a closure
  const sessionRef = useRef<UserSession | null>(null);
  // Bumped on login/logout/clerk sync; async results from an older generation are dropped
  const genRef = useRef(0);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  const syncInFlight = useRef(false);
  const applySession = (s: UserSession | null) => {
    sessionRef.current = s;
    setSession(s);
  };
  // Offline demo session is fabricated locally; never send it to the server
  const isOfflineDemo = () => {
    const token = api.getSession()?.accessToken;
    return Boolean(token && (token.startsWith('demo-token-') || token.startsWith('demo-driver-token-') || token.startsWith('demo-')));
  };

  // Identity used to isolate the local cache + outbox by account (owner email, else driver email)
  const storageIdFor = (s: UserSession | null) => (s?.owner?.email || s?.driver?.email || '').toLowerCase().trim();

  // Helper to isolate local cache by user email
  const getStorageKey = (email?: string) => {
    const clean = (email || '').toLowerCase().trim();
    return clean ? `stayride_local_db_${clean.replace(/[^a-z0-9]/g, '_')}` : 'stayride_local_db_guest';
  };

  // Outbox lives in the same per-account key family as the local database
  const getOutboxKey = (email?: string) => {
    const clean = (email || '').toLowerCase().trim();
    return clean ? `stayride_outbox_${clean.replace(/[^a-z0-9]/g, '_')}` : 'stayride_outbox_guest';
  };

  // Point the outbox at the given account and reflect its depth in state
  const bindOutbox = (email?: string) => {
    outbox.configure(getOutboxKey(email));
    // Writes are online-only now; anything left from an older build could carry local ids or
    // a stale price, so it is discarded rather than replayed.
    outbox.clear().catch(() => {});
    setOutboxCount(outbox.count());
  };

  // Keep the banner count in sync with the queue
  useEffect(() => {
    const unsubscribe = outbox.onChange(() => setOutboxCount(outbox.count()));
    return unsubscribe;
  }, []);

  // Replace the read-model state with a cached local snapshot
  const applyCachedState = (parsed: any) => {
    setRooms(parsed.rooms || []);
    setGuests(parsed.guests || []);
    setBookings(parsed.bookings || []);
    setDrivers(parsed.drivers || []);
    setNetworkDrivers(parsed.networkDrivers || []);
    setTrips(parsed.trips || []);
    setDriverTrips(parsed.driverTrips || []);
    setCampaigns(parsed.campaigns || []);
    setHomestay(parsed.homestay || {});
    setNextIds(parsed.nextIds || { room: 10, guest: 20, booking: 100, driver: 20, trip: 20, campaign: 10 });
    if (parsed.features) setFeatures(parsed.features);
    if (parsed.commissionRates) setCommissionRates(parsed.commissionRates);
    if (parsed.config) setConfig(parsed.config);
  };

  // Load from local storage or initialize fresh workspace
  useEffect(() => {
    async function bootstrap() {
      await api.init();
      const currentSession = api.getSession();
      applySession(currentSession);

      // Check backend server connectivity in background
      api.checkHealth().then((isLive) => {
        setBackendStatus(isLive ? 'connected' : 'offline');
      });

      const userEmail = currentSession?.owner?.email;
      const driverEmail = currentSession?.driver?.email;
      const isDemoAccount = (userEmail || '').toLowerCase().trim() === 'demo@stayride.in';
      const storageId = storageIdFor(currentSession);
      bindOutbox(storageId);

      // One-time migration: drivers used to share the guest bucket (stayride_local_db_guest).
      // If this driver's own bucket is empty, copy the legacy guest bucket over once. A claim key
      // stops a second driver account from claiming the same legacy data, and the legacy key is
      // left untouched so the migration is non-destructive.
      if (driverEmail && !userEmail) {
        const driverKey = getStorageKey(storageId);
        const existing = await AsyncStorage.getItem(driverKey);
        if (!existing) {
          try {
            const claim = await AsyncStorage.getItem('stayride_guest_bucket_claim');
            if (!claim || claim === storageId) {
              const legacy = await AsyncStorage.getItem(getStorageKey(''));
              if (legacy) {
                await AsyncStorage.setItem(driverKey, legacy);
                await AsyncStorage.setItem('stayride_guest_bucket_claim', storageId);
              }
            }
          } catch (e) {
            console.warn('[StayRide] driver cache migration failed:', e);
          }
        }
      }

      const key = getStorageKey(storageId);
      const localData = await AsyncStorage.getItem(key);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);

          // If local data was in demo mode, but current user is NOT the demo account, clear to fresh workspace
          if (!isDemoAccount && parsed.isDemoMode) {
            await initFreshWorkspace();
          } else {
            applyCachedState(parsed);
            setIsDemoMode(Boolean(parsed.isDemoMode) && isDemoAccount);
          }
        } catch (e) {
          console.warn('[StayRide] local cache unreadable, starting fresh:', e);
          await initFreshWorkspace();
        }
      } else if (isDemoAccount) {
        await loadDemoShowcase();
      } else {
        // Fresh install / real user: start with clean fresh homestay (0 rooms, 0 guests, 0 bookings)
        await initFreshWorkspace();
      }
      setLoading(false);

      if (currentSession?.accessToken) {
        // sync() flushes the outbox first, then pulls server truth by id
        sync().catch(() => {});
      }
    }
    bootstrap();
    const unsubExpired = api.onSessionExpired((code) => {
      signOutLocal(
        code === 'SESSION_REVOKED'
          ? 'You were signed out because your sessions were ended (for example with "Sign out of all devices"). Please sign in again.'
          : undefined
      ).catch(() => {});
    });
    const unsubUpdated = api.onSessionUpdated((updatedSession) => {
      setSession(updatedSession);
    });
    const unsubAccount = api.onAccountError((code, message) => {
      if (code === 'ACCOUNT_BLOCKED' || code === 'OWNER_NOT_APPROVED') {
        setAccountBlock(message);
        return;
      }
      // DRIVER_NOT_APPROVED: reflect the server state in the session so driver screens show "Awaiting approval"
      const cur = sessionRef.current;
      if (cur?.driver && cur.driver.status !== 'PENDING_APPROVAL') {
        const next: UserSession = { ...cur, driver: { ...cur.driver, status: 'PENDING_APPROVAL' } };
        applySession(next);
        api.saveSession(next).catch(() => {});
      }
    });
    return () => {
      unsubExpired?.();
      unsubUpdated?.();
      unsubAccount?.();
    };
  }, []);

  // Sync schedule: full sync (flush outbox, then pull server truth) on app foreground and every
  // 30s while the app is in the foreground, so admin changes (block, features, commission, trip
  // status) reach the device without a manual refresh.
  // ponytail: polling, move to push notifications when trip volume makes 30s staleness matter.
  useEffect(() => {
    const runSync = () => {
      if (api.isLoggedIn() && !isOfflineDemo()) syncRef.current().catch(() => {});
      // Nothing to sync (signed out or offline demo): still keep the connection status truthful
      else api.checkHealth().then((live) => setBackendStatus(live ? 'connected' : 'offline'));
    };
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') runSync();
    }, 30000);
    return () => {
      appStateSub.remove();
      clearInterval(timer);
    };
  }, []);

  const initFreshWorkspace = async (info?: Partial<Homestay>) => {
    const freshHomestay: Homestay = {
      name: info?.name || '',
      description: info?.description || '',
      location: info?.location || '',
      phone: info?.phone || '',
      email: info?.email || '',
      ownerName: info?.ownerName || '',
      // The public link is issued by the server (unique slug); never guess one locally
      link: info?.link || '',
      mapQuery: info?.location || '',
      amenities: [],
      photos: [],
    };

    setRooms([]);
    setGuests([]);
    setBookings([]);
    setDrivers([]);
    setNetworkDrivers([]);
    setTrips([]);
    setCampaigns([]);
    setHomestay(freshHomestay);
    setIsDemoMode(false);
    setNextIds({ room: 1, guest: 1, booking: 1, driver: 1, trip: 1, campaign: 1 });

    await persist({
      rooms: [],
      guests: [],
      bookings: [],
      drivers: [],
      networkDrivers: [],
      trips: [],
      campaigns: [],
      homestay: freshHomestay,
      isDemoMode: false,
      nextIds: { room: 1, guest: 1, booking: 1, driver: 1, trip: 1, campaign: 1 },
    });
  };

  const loadDemoShowcase = async () => {
    const s = generateSeedData();
    setRooms(s.rooms);
    setGuests(s.guests);
    setBookings(s.bookings);
    setDrivers(s.drivers);
    setNetworkDrivers(s.networkDrivers);
    setTrips(s.trips);
    setCampaigns(s.campaigns);
    setHomestay(s.homestay);
    setIsDemoMode(true);
    setNextIds(s.nextIds);
    await persist(
      {
        rooms: s.rooms,
        guests: s.guests,
        bookings: s.bookings,
        drivers: s.drivers,
        networkDrivers: s.networkDrivers,
        trips: s.trips,
        campaigns: s.campaigns,
        homestay: s.homestay,
        isDemoMode: true,
        nextIds: s.nextIds,
      },
      'demo@stayride.in'
    );
  };

  async function persist(all: any, customEmail?: string) {
    const email = customEmail !== undefined ? customEmail : storageIdFor(sessionRef.current);
    const key = getStorageKey(email);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(all));
    } catch (e) {
      // A failed local save silently breaks the cache; surface it in logs rather than swallowing it.
      console.warn('[StayRide] failed to persist local database:', e);
    }
  }

  // Auto-save on state change
  useEffect(() => {
    if (!loading) {
      persist({ rooms, guests, bookings, drivers, networkDrivers, trips, driverTrips, campaigns, homestay, isDemoMode, nextIds, features, commissionRates, config });
    }
  }, [rooms, guests, bookings, drivers, networkDrivers, trips, driverTrips, campaigns, homestay, isDemoMode, nextIds, features, commissionRates, config, loading]);

  // Sync with real backend using high-speed /snapshot aggregator.
  // 1) flush the outbox so the server is at least as new as the local state, then
  // 2) replace read models with server truth — except rows with a still-pending mutation, which
  //    are kept locally until their outbox entry flushes (so an offline optimistic row is not wiped).
  const sync = async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      await syncOnce();
    } finally {
      syncInFlight.current = false;
    }
  };
  syncRef.current = sync;

  // Ask for push once per signed-in app run, only after the server accepted this session
  const ensurePush = (gen: number) => {
    if (pushTriedRef.current) return;
    pushTriedRef.current = true;
    registerForPush().then((token) => {
      if (gen === genRef.current) setPushEnabled(!!token);
    });
  };

  const syncOnce = async () => {
    const gen = genRef.current;

    await outbox.flush().catch(() => undefined);
    if (gen !== genRef.current) return;
    const pending = outbox.pendingFamilies();

    const isLive = await api.checkHealth();
    if (gen !== genRef.current) return;
    setBackendStatus(isLive ? 'connected' : 'offline');
    if (!isLive || !api.isLoggedIn()) return;
    setSyncing(true);
    try {
      const snap = await api.get('/snapshot');
      if (gen !== genRef.current) return; // user changed while this sync was in flight
      setAccountBlock(null);
      if (snap?.config) setConfig(setPlatformConfig(snap.config));
      if (snap?.driverProfile) {
        // Driver snapshot: merge server truth while preserving any offline optimistic mutations until flushed
        const serverTrips: DriverTrip[] = Array.isArray(snap.trips) ? snap.trips : [];
        setDriverTrips((prev) => {
          const pendingMap = new Map(prev.filter((t) => t._pendingStartOtp || t._pendingComplete).map((t) => [t.reference, t]));
          if (pendingMap.size === 0) return serverTrips;
          return serverTrips.map((st) => {
            const pending = pendingMap.get(st.reference);
            if (!pending) return st;
            if (pending._pendingComplete && st.status !== 'COMPLETED') {
              return { ...st, status: 'COMPLETED' as any, _pendingComplete: true };
            }
            if (pending._pendingStartOtp && st.status !== 'TRIP_STARTED' && st.status !== 'COMPLETED') {
              return { ...st, status: 'TRIP_STARTED' as any, _pendingStartOtp: pending._pendingStartOtp };
            }
            return st;
          });
        });
        const cur = sessionRef.current;
        if (cur) {
          const next: UserSession = { ...cur, driver: snap.driverProfile };
          applySession(next);
          await api.saveSession(next);
        }
      } else if (snap) {
        const driversPending = pending.has('drivers') || pending.has('driver');
        if (snap.account?.features) setFeatures(snap.account.features);
        if (snap.homestay) {
          setHomestay((prev) => (pending.has('homestay') ? { ...snap.homestay, ...prev } : snap.homestay));
        }
        if (Array.isArray(snap.rooms)) setRooms((prev) => (pending.has('rooms') ? mergePendingById(prev, snap.rooms) : snap.rooms));
        if (Array.isArray(snap.guests)) setGuests((prev) => (pending.has('guests') ? mergePendingById(prev, snap.guests) : snap.guests));
        if (Array.isArray(snap.bookings)) setBookings((prev) => (pending.has('bookings') ? mergePendingById(prev, snap.bookings) : snap.bookings));
        if (Array.isArray(snap.drivers)) setDrivers((prev) => (driversPending ? mergePendingById(prev, snap.drivers) : snap.drivers));
        if (Array.isArray(snap.networkDrivers)) {
          setNetworkDrivers((prev) => (driversPending ? mergePendingById(prev, snap.networkDrivers) : snap.networkDrivers));
        }
        if (Array.isArray(snap.trips)) setTrips((prev) => (pending.has('trips') ? mergePendingById(prev, snap.trips) : snap.trips));
        if (Array.isArray(snap.campaigns)) setCampaigns((prev) => (pending.has('campaigns') ? mergePendingById(prev, snap.campaigns) : snap.campaigns));
        if (snap.commissionRates) setCommissionRates(snap.commissionRates);
        refreshPayoutSummary().catch((e) => console.warn('[StayRide] payout summary refresh failed:', e));
      }
      setBackendStatus('connected');
      ensurePush(gen);
      // 2) The connection is proven good; drain anything that queued while we were reading.
      outbox.flush().catch(() => undefined);
    } catch (e) {
      // Account errors are surfaced by the api listener; anything else falls back to the offline store
      if (e instanceof ApiError && e.code === 'DRIVER_NOT_APPROVED') ensurePush(gen); // so "approved" can reach them
      if (e instanceof ApiError && (e.code === 'ACCOUNT_BLOCKED' || e.code === 'DRIVER_NOT_APPROVED')) return;
      // An HTTP answer (even an error) proves the server is reachable; only a network failure is "offline"
      if (gen === genRef.current) setBackendStatus(e instanceof ApiError ? 'connected' : 'offline');
      if (e instanceof ApiError) console.warn(`[StayRide] sync failed: ${e.status} ${e.code || e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Commission balance is computed only by the server
  const refreshPayoutSummary = async () => {
    if (!api.isLoggedIn() || sessionRef.current?.role === 'driver') return null;
    const summary: PayoutSummary = await api.get('/payouts/summary');
    setPayoutSummary(summary);
    return summary;
  };

  const requestFeature = async (featureKey: FeatureKey, reason: string): Promise<ActionOutcome> => {
    // Optimistic UI has no state to keep, so there is nothing to roll back on failure
    return submit('POST', '/appeals', { featureKey, reason });
  };

  // Queue a mutation, attempt to flush, and translate the outbox outcome into an ActionOutcome.
  //  - 2xx            → apply the server entity (server truth) and report synced
  //  - network/5xx    → dropped and rolled back (writes are online-only)
  //  - other 4xx/410  → the optimistic change is rolled back and the error is surfaced
  const submit = async (
    method: OutboxMethod,
    path: string,
    body?: any,
    opts?: { rollback?: () => void; applyServer?: (entity: any) => void }
  ): Promise<ActionOutcome> => {
    if (!api.isLoggedIn()) {
      opts?.rollback?.();
      return { ok: false, synced: false, error: 'Please sign in again to save changes.' };
    }
    const entry = await outbox.enqueue(method, path, body);
    const outcome = await outbox.flush();
    const result = outcome.results[entry.id];
    if (result?.status === 'ok') {
      if (result.entity !== undefined) opts?.applyServer?.(result.entity);
      return { ok: true, synced: true };
    }
    if (result?.status === 'terminal' && result.code === 'IDEMPOTENCY_IN_PROGRESS') {
      // The same submission is still being saved on the server; show its result instead of a duplicate
      opts?.rollback?.();
      sync().catch(() => {});
      return { ok: false, synced: false, error: 'Still saving your previous attempt. Check again in a moment.' };
    }
    if (result?.status === 'terminal') {
      opts?.rollback?.();
      return { ok: false, synced: false, error: result.error || 'Could not save your change.' };
    }
    // Offline / 5xx: never keep the write for a later replay. Money, dispatch and bookings must
    // only change when the server confirms, so drop the entry, undo the screen and tell the user.
    await outbox.remove(entry.id);
    opts?.rollback?.();
    sync().catch(() => {}); // the request may have reached the server; adopt whatever it holds
    return { ok: false, synced: false, error: result?.error && !/network|abort/i.test(result.error) ? result.error : 'No connection to server. Nothing was saved, please try again.' };
  };

  // ------------------------- Computed Metrics -------------------------

  const todayBookings = () => {
    const today = todayMidnight();
    return bookings.filter(
      (b) => b.checkIn === today && b.status !== 'CANCELLED'
    );
  };

  const currentGuestCount = () => {
    return bookings
      .filter((b) => b.status === 'CHECKED_IN')
      .reduce((sum, b) => sum + Math.max(1, b.guests), 0);
  };

  const availableRoomCount = () => {
    return roomsView.filter((r) => r.status === 'AVAILABLE').length;
  };

  const monthRevenue = () => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    return bookings
      .filter((b) => {
        if (b.status === 'CANCELLED') return false;
        const d = new Date(b.checkIn);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      })
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  };

  const occupancyPercent = () => {
    if (rooms.length === 0) return 0;
    const occupied = roomsView.filter((r) => r.status === 'OCCUPIED' || r.status === 'RESERVED').length;
    return Math.round((occupied * 100) / rooms.length);
  };

  // Sum of the commission the server reports as earned on platform trips (own-driver trips never earn)
  const commissionEarned = () => {
    return trips.filter((t) => t.platform).reduce((sum, t) => sum + (t.commission || 0), 0);
  };

  const totalBookings = () => bookings.length;

  const recentBookings = (limit = 4) => {
    return [...bookings]
      .sort((a, b) => b.checkIn - a.checkIn)
      .slice(0, limit);
  };

  const upcomingCheckIns = (limit = 3) => {
    const today = todayMidnight();
    return bookings
      .filter((b) => b.status === 'CONFIRMED' && b.checkIn >= today)
      .sort((a, b) => a.checkIn - b.checkIn)
      .slice(0, limit);
  };

  const recentTrips = (limit = 3) => {
    return [...trips]
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
  };

  const countRooms = (status: RoomStatus | 'ALL') => {
    if (status === 'ALL') return rooms.length;
    return roomsView.filter((r) => r.status === status).length;
  };

  const countGuests = (isRepeat: boolean) => {
    return guests.filter((g) => (isRepeat ? g.visits > 1 : g.visits <= 1)).length;
  };

  const searchGuests = (query: string, filter: string, periodDays: number) => {
    const q = query.toLowerCase().trim();
    const cutoff = periodDays > 0 ? Date.now() - periodDays * DAY_MS : 0;

    return guests.filter((g) => {
      const matchesQ =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.phone.includes(q) ||
        (g.email && g.email.toLowerCase().includes(q));

      const matchesFilter =
        filter === 'ALL'
          ? true
          : filter === 'REPEAT'
          ? g.visits > 1
          : g.visits <= 1;

      const matchesPeriod = cutoff === 0 || g.lastVisit >= cutoff;

      return matchesQ && matchesFilter && matchesPeriod;
    });
  };

  const getChartData = (
    metric: 'revenue' | 'bookings' | 'cabs' | 'commission',
    period: '7d' | '30d' | '6m' | '1y'
  ) => {
    // If in demo showcase mode, return the rich realistic showcase curve
    if (isDemoMode) {
      if (metric === 'revenue') {
        if (period === '7d') return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [1800, 5200, 3600, 7800, 9600, 14200, 11800] };
        if (period === '30d') return { labels: ['W1', 'W2', 'W3', 'W4', 'W5'], values: [42000, 58000, 64000, 51000, 72000] };
        if (period === '6m') return { labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], values: [186000, 214000, 172000, 248000, 265000, 284000] };
        return { labels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'], values: [140000, 190000, 220000, 260000, 248000, 290000] };
      }
      if (metric === 'bookings') {
        if (period === '7d') return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [1, 2, 1, 3, 4, 6, 5] };
        if (period === '30d') return { labels: ['W1', 'W2', 'W3', 'W4', 'W5'], values: [8, 12, 15, 11, 14] };
        return { labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], values: [46, 52, 41, 63, 68, 71] };
      }
      if (metric === 'cabs') {
        if (period === '7d') return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [2, 3, 1, 4, 5, 8, 6] };
        if (period === '30d') return { labels: ['W1', 'W2', 'W3', 'W4', 'W5'], values: [6, 9, 8, 11, 13] };
        return { labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], values: [14, 19, 16, 24, 27, 31] };
      }
      // commission
      if (period === '7d') return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [240, 360, 120, 480, 600, 960, 720] };
      return { labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], values: [4200, 5800, 4900, 7200, 8100, 9300] };
    }

    // Dynamic aggregation for real production user from actual store bookings and trips
    const now = new Date();
    const todayMidnightTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (period === '7d') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const labels: string[] = [];
      const values: number[] = [];

      for (let i = 6; i >= 0; i--) {
        const dayStart = todayMidnightTs - i * DAY_MS;
        const dayEnd = dayStart + DAY_MS;
        const d = new Date(dayStart);
        labels.push(dayNames[d.getDay()]);

        let val = 0;
        if (metric === 'revenue') {
          val = bookings
            .filter((b) => b.status !== 'CANCELLED' && b.checkIn >= dayStart && b.checkIn < dayEnd)
            .reduce((sum, b) => sum + (b.amount || 0), 0);
        } else if (metric === 'bookings') {
          val = bookings.filter((b) => b.status !== 'CANCELLED' && b.checkIn >= dayStart && b.checkIn < dayEnd).length;
        } else if (metric === 'cabs') {
          val = trips.filter((t) => t.date >= dayStart && t.date < dayEnd).length;
        } else {
          val = trips
            .filter((t) => t.platform && t.date >= dayStart && t.date < dayEnd)
            .reduce((sum, t) => sum + (t.commission || 0), 0);
        }
        values.push(val);
      }
      return { labels, values };
    }

    if (period === '30d') {
      const labels = ['W1', 'W2', 'W3', 'W4', 'W5'];
      const values: number[] = [];

      for (let w = 4; w >= 0; w--) {
        const wStart = todayMidnightTs - (w + 1) * 7 * DAY_MS;
        const wEnd = todayMidnightTs - w * 7 * DAY_MS;

        let val = 0;
        if (metric === 'revenue') {
          val = bookings
            .filter((b) => b.status !== 'CANCELLED' && b.checkIn >= wStart && b.checkIn < wEnd)
            .reduce((sum, b) => sum + (b.amount || 0), 0);
        } else if (metric === 'bookings') {
          val = bookings.filter((b) => b.status !== 'CANCELLED' && b.checkIn >= wStart && b.checkIn < wEnd).length;
        } else if (metric === 'cabs') {
          val = trips.filter((t) => t.date >= wStart && t.date < wEnd).length;
        } else {
          val = trips
            .filter((t) => t.platform && t.date >= wStart && t.date < wEnd)
            .reduce((sum, t) => sum + (t.commission || 0), 0);
        }
        values.push(val);
      }
      return { labels, values };
    }

    // 6m and 1y periods
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const count = period === '1y' ? 12 : 6;
    const labels: string[] = [];
    const values: number[] = [];

    for (let m = count - 1; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mStart = d.getTime();
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      labels.push(monthNames[d.getMonth()]);

      let val = 0;
      if (metric === 'revenue') {
        val = bookings
          .filter((b) => b.status !== 'CANCELLED' && b.checkIn >= mStart && b.checkIn < mEnd)
          .reduce((sum, b) => sum + (b.amount || 0), 0);
      } else if (metric === 'bookings') {
        val = bookings.filter((b) => b.status !== 'CANCELLED' && b.checkIn >= mStart && b.checkIn < mEnd).length;
      } else if (metric === 'cabs') {
        val = trips.filter((t) => t.date >= mStart && t.date < mEnd).length;
      } else {
        val = trips
          .filter((t) => t.platform && t.date >= mStart && t.date < mEnd)
          .reduce((sum, t) => sum + (t.commission || 0), 0);
      }
      values.push(val);
    }
    return { labels, values };
  };

  // ------------------------- Booking Actions -------------------------

  // The server checks dates/room, and finds or creates the guest in the same step (no orphan guest).
  // guestId 0 = "new or unknown guest": the server matches by phone or creates one.
  const createBooking = async (data: Omit<Booking, 'id' | 'status'> & { paid?: boolean; advance?: number; advanceMethod?: PaymentMethod }) => {
    const id = nextIds.booking;
    const newBk: Booking = { ...data, id, status: 'CONFIRMED', paid: Boolean(data.paid) };
    setBookings((prev) => [newBk, ...prev]);
    setNextIds((prev) => ({ ...prev, booking: prev.booking + 1 }));
    let serverBk: Booking | undefined;
    const outcome = await submit('POST', '/bookings', data, {
      applyServer: (entity) => {
        if (entity?.id) {
          const { guest, ...booking } = entity as Booking & { guest?: Guest };
          serverBk = booking as Booking;
          setBookings((prev) => prev.map((b) => (b === newBk ? serverBk! : b)));
          if (guest?.id) setGuests((prev) => (prev.some((g) => g.id === guest.id) ? prev : [guest, ...prev]));
        }
      },
      rollback: () => setBookings((prev) => prev.filter((b) => b !== newBk)),
    });
    if (!outcome.ok) throw new Error(outcome.error || 'Could not save the booking.');
    return serverBk ?? newBk;
  };

  // Room statuses follow from the booking (see roomsView); only the booking changes here.
  const checkInBooking = async (id: number): Promise<ActionOutcome> => {
    const prevBooking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CHECKED_IN' } : b)));
    return submit('POST', `/bookings/${id}/check-in`, undefined, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
      rollback: () => {
        if (prevBooking) setBookings((prev) => prev.map((b) => (b.id === id ? prevBooking : b)));
      },
    });
  };

  // Guest visits/spending are counted by the server (once, paid stays only); pull them after checkout.
  const checkOutBooking = async (id: number): Promise<ActionOutcome> => {
    const prevBooking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CHECKED_OUT', actualCheckOut: Date.now() } : b)));
    const outcome = await submit('POST', `/bookings/${id}/check-out`, undefined, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
      rollback: () => {
        if (prevBooking) setBookings((prev) => prev.map((b) => (b.id === id ? prevBooking : b)));
      },
    });
    if (outcome.ok) sync().catch(() => {});
    return outcome;
  };

  const cancelBooking = async (id: number): Promise<ActionOutcome> => {
    const prevBooking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)));
    return submit('POST', `/bookings/${id}/cancel`, undefined, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
      rollback: () => {
        if (prevBooking) setBookings((prev) => prev.map((b) => (b.id === id ? prevBooking : b)));
      },
    });
  };

  const setBookingPaid = async (id: number, paid: boolean): Promise<ActionOutcome> => {
    const prevBooking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, paid } : b)));
    // a paid checked-out stay changes the guest's spending on the server: pull it
    const refresh = (o: ActionOutcome) => {
      if (o.ok && prevBooking?.status === 'CHECKED_OUT') sync().catch(() => {});
      return o;
    };
    return refresh(await submit('PATCH', `/bookings/${id}/payment`, { paid }, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
      rollback: () => {
        if (prevBooking) setBookings((prev) => prev.map((b) => (b.id === id ? prevBooking : b)));
      },
    }));
  };

  const addPayment = (id: number, payment: { amount: number; method: PaymentMethod; note?: string }): Promise<ActionOutcome> =>
    submit('POST', `/bookings/${id}/payments`, payment, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
    });

  const removePayment = (id: number, paymentId: number): Promise<ActionOutcome> =>
    submit('DELETE', `/bookings/${id}/payments/${paymentId}`, undefined, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
    });

  // Calendar sync reads/writes the server directly: it fetches the OTA calendars and changes bookings,
  // so pull the bookings afterwards
  const getRoomCalendar = async (roomId: number) => (await api.get(`/rooms/${roomId}/ical`)) as RoomCalendar;
  const setRoomCalendarLinks = async (roomId: number, importUrls: string[]) => {
    const res = (await api.put(`/rooms/${roomId}/ical`, { importUrls })) as RoomCalendar;
    sync().catch(() => {});
    return res;
  };
  const syncRoomCalendar = async (roomId: number) => {
    const res = (await api.post(`/rooms/${roomId}/ical/sync`)) as RoomCalendar;
    sync().catch(() => {});
    return res;
  };

  /** Change dates / amount / party size; the server checks the room is free for the new dates. */
  const editBooking = async (id: number, changes: { checkIn?: number; checkOut?: number; amount?: number; guests?: number }): Promise<ActionOutcome> => {
    const prevBooking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...changes } : b)));
    return submit('PATCH', `/bookings/${id}`, changes, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
      rollback: () => {
        if (prevBooking) setBookings((prev) => prev.map((b) => (b.id === id ? prevBooking : b)));
      },
    });
  };

  const changeBookingRoom = async (id: number, roomNumber: string): Promise<ActionOutcome> => {
    const prevBooking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, roomNumber } : b)));
    return submit('POST', `/bookings/${id}/room`, { roomNumber }, {
      applyServer: (entity) => {
        if (entity?.id) setBookings((prev) => prev.map((b) => (b.id === id ? entity : b)));
      },
      rollback: () => {
        if (prevBooking) setBookings((prev) => prev.map((b) => (b.id === id ? prevBooking : b)));
      },
    });
  };

  // ------------------------- Rooms Actions -------------------------

  const createRoom = async (data: Omit<Room, 'id'>) => {
    const id = nextIds.room;
    const r: Room = { ...data, id };
    setRooms((prev) => [...prev, r]);
    setNextIds((prev) => ({ ...prev, room: prev.room + 1 }));
    let serverR: Room | undefined;
    const outcome = await submit('POST', '/rooms', data, {
      applyServer: (entity) => {
        if (entity?.id) {
          serverR = entity as Room;
          setRooms((prev) => prev.map((item) => (item === r ? (entity as Room) : item)));
        }
      },
      rollback: () => setRooms((prev) => prev.filter((item) => item !== r)),
    });
    if (!outcome.ok) throw new Error(outcome.error || 'Could not save the room.');
    return serverR ?? r;
  };

  const updateRoom = async (id: number, data: Partial<Room>): Promise<ActionOutcome> => {
    const prevRoom = rooms.find((r) => r.id === id);
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    return submit('PUT', `/rooms/${id}`, data, {
      applyServer: (entity) => {
        if (entity?.id) setRooms((prev) => prev.map((r) => (r.id === id ? entity : r)));
      },
      rollback: () => {
        if (prevRoom) setRooms((prev) => prev.map((r) => (r.id === id ? prevRoom : r)));
      },
    });
  };

  const deleteRoom = async (id: number): Promise<ActionOutcome> => {
    const prevRoom = rooms.find((r) => r.id === id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    return submit('DELETE', `/rooms/${id}`, undefined, {
      rollback: () => {
        if (prevRoom) setRooms((prev) => [prevRoom, ...prev]);
      },
    });
  };

  // ------------------------- Guest Actions -------------------------

  const createGuest = async (data: any) => {
    const id = nextIds.guest;
    const g: Guest = {
      ...data,
      id,
      visits: data.visits || 0, // the server counts visits at checkout
      totalSpending: data.totalSpending || 0,
      firstVisit: Date.now(),
      lastVisit: Date.now(),
    };
    setGuests((prev) => [g, ...prev]);
    setNextIds((prev) => ({ ...prev, guest: prev.guest + 1 }));
    let serverG: Guest | undefined;
    const outcome = await submit('POST', '/guests', data, {
      applyServer: (entity) => {
        if (entity?.id) {
          serverG = entity as Guest;
          setGuests((prev) => prev.map((item) => (item === g ? (entity as Guest) : item)));
        }
      },
      rollback: () => setGuests((prev) => prev.filter((item) => item !== g)),
    });
    if (!outcome.ok) throw new Error(outcome.error || 'Could not save the guest.');
    return serverG ?? g;
  };

  const updateGuest = async (id: number, data: Partial<Guest>): Promise<ActionOutcome> => {
    const prevGuest = guests.find((g) => g.id === id);
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
    return submit('PUT', `/guests/${id}`, data, {
      applyServer: (entity) => {
        if (entity?.id) setGuests((prev) => prev.map((g) => (g.id === id ? entity : g)));
      },
      rollback: () => {
        if (prevGuest) setGuests((prev) => prev.map((g) => (g.id === id ? prevGuest : g)));
      },
    });
  };

  // The server refuses (409) when the guest has an active booking
  const deleteGuest = async (id: number): Promise<ActionOutcome> => {
    const prevGuest = guests.find((g) => g.id === id);
    setGuests((prev) => prev.filter((g) => g.id !== id));
    return submit('DELETE', `/guests/${id}`, undefined, {
      rollback: () => {
        if (prevGuest) setGuests((prev) => [prevGuest, ...prev]);
      },
    });
  };

  // ------------------------- Driver Actions -------------------------

  const createDriver = async (data: any) => {
    const id = nextIds.driver;
    const d: Driver = { ...data, id, available: true, active: true, ownerDriver: true };
    setDrivers((prev) => [...prev, d]);
    setNextIds((prev) => ({ ...prev, driver: prev.driver + 1 }));
    let serverD: Driver | undefined;
    const outcome = await submit('POST', '/drivers', data, {
      applyServer: (entity) => {
        if (entity?.id) {
          serverD = entity as Driver;
          setDrivers((prev) => prev.map((item) => (item === d ? (entity as Driver) : item)));
        }
      },
      rollback: () => setDrivers((prev) => prev.filter((item) => item !== d)),
    });
    if (!outcome.ok) throw new Error(outcome.error || 'Could not save the driver.');
    return serverD ?? d;
  };

  const updateDriver = async (id: number, data: Partial<Driver>): Promise<ActionOutcome> => {
    const prevDriver = drivers.find((d) => d.id === id);
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
    return submit('PUT', `/drivers/${id}`, data, {
      applyServer: (entity) => {
        if (entity?.id) setDrivers((prev) => prev.map((d) => (d.id === id ? entity : d)));
      },
      rollback: () => {
        if (prevDriver) setDrivers((prev) => prev.map((d) => (d.id === id ? prevDriver : d)));
      },
    });
  };

  const setDriverAvailability = async (id: number, available: boolean): Promise<ActionOutcome> => {
    const prevDriver = drivers.find((d) => d.id === id);
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, available } : d)));
    return submit('PATCH', `/drivers/${id}/availability`, { available }, {
      applyServer: (entity) => {
        if (entity?.id) setDrivers((prev) => prev.map((d) => (d.id === id ? entity : d)));
      },
      rollback: () => {
        if (prevDriver) setDrivers((prev) => prev.map((d) => (d.id === id ? prevDriver : d)));
      },
    });
  };

  // Not queued offline: a stale position is worse than none, the next report replaces it anyway
  // Stable identity (only uses the api module) so screens can depend on it in effects
  const reportDriverLocation = useCallback(async (lat: number, lng: number) => {
    try {
      await api.patch('/driver/location', { lat, lng });
    } catch (e: any) {
      console.warn('[StayRide] location report failed:', e?.message);
    }
  }, []);

  const setDriverOnline = async (available: boolean): Promise<ActionOutcome> => {
    const cur = sessionRef.current;
    if (!cur?.driver) return { ok: false, synced: false, error: 'Not signed in as a driver.' };
    const updatedSession: UserSession = { ...cur, driver: { ...cur.driver, available } };
    applySession(updatedSession);
    await api.saveSession(updatedSession);
    return submit('PATCH', '/driver/availability', { available }, {
      rollback: () => {
        const reverted: UserSession = { ...cur, driver: { ...cur.driver!, available: !available } };
        applySession(reverted);
        api.saveSession(reverted).catch((e) => console.warn('[StayRide] driver session revert failed:', e));
      },
    });
  };

  const setDriverActive = async (id: number, active: boolean): Promise<ActionOutcome> => {
    const prevDriver = drivers.find((d) => d.id === id);
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, active } : d)));
    return submit('PATCH', `/drivers/${id}/active`, { active }, {
      applyServer: (entity) => {
        if (entity?.id) setDrivers((prev) => prev.map((d) => (d.id === id ? entity : d)));
      },
      rollback: () => {
        if (prevDriver) setDrivers((prev) => prev.map((d) => (d.id === id ? prevDriver : d)));
      },
    });
  };

  const deleteDriver = async (id: number): Promise<ActionOutcome> => {
    const prevDriver = drivers.find((d) => d.id === id);
    setDrivers((prev) => prev.filter((d) => d.id !== id));
    return submit('DELETE', `/drivers/${id}`, undefined, {
      rollback: () => {
        if (prevDriver) setDrivers((prev) => [prevDriver, ...prev]);
      },
    });
  };

  // ------------------------- Trip Actions -------------------------

  // Display estimate only (the real fare comes from a quote); values set by the admin
  const estimateFare = (vehicleType: string) => config.vehicles.find((v) => v.value === vehicleType)?.estFare ?? 0;

  // POST /trips accepts only these fields; anything else (source, assignedDriver*) stays local
  const tripRequestBody = (d: any) => ({
    guestName: d.guestName,
    phone: d.phone,
    pickup: d.pickup,
    pickupLat: d.pickupLat,
    pickupLng: d.pickupLng,
    destination: d.destination,
    destinations: d.destinations,
    isRoundTrip: d.isRoundTrip,
    returnDate: d.returnDate,
    returnTime: d.returnTime,
    date: d.date,
    time: d.time,
    passengers: d.passengers,
    vehicleType: d.vehicleType,
    guestId: d.guestId,
    bookingId: d.bookingId,
    dispatchMode: d.dispatchMode === 'PLATFORM' ? 'PLATFORM' : 'OWN_DRIVER',
  });

  const createTrip = async (data: any) => {
    const id = nextIds.trip;
    const estFare = estimateFare(data.vehicleType);
    const t: CabTrip = {
      ...data,
      id,
      estFare,
      status: 'NEW_REQUEST',
      driverId: null,
      driverName: null,
      ownerDriver: false,
      fare: 0,
      commission: 0,
      commissionPaid: false,
      platform: data.dispatchMode === 'PLATFORM',
    };
    setTrips((prev) => [t, ...prev]);
    setNextIds((prev) => ({ ...prev, trip: prev.trip + 1 }));
    let serverT: CabTrip | undefined;
    const outcome = await submit('POST', '/trips', tripRequestBody(data), {
      applyServer: (entity) => {
        if (entity?.id) {
          serverT = entity as CabTrip;
          setTrips((prev) => prev.map((item) => (item === t ? (entity as CabTrip) : item)));
        }
      },
      rollback: () => setTrips((prev) => prev.filter((item) => item !== t)),
    });
    if (!outcome.ok) throw new Error(outcome.error || 'Could not save the trip.');
    return serverT ?? t;
  };

  const assignTripDriver = async (tripId: number, driverId: number, fare: number): Promise<ActionOutcome> => {
    const prevTrip = trips.find((t) => t.id === tripId);
    const allDrivers = [...drivers, ...networkDrivers];
    const d = allDrivers.find((x) => x.id === driverId);
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              status: 'DRIVER_ASSIGNED',
              driverId,
              driverName: d?.name || null,
              ownerDriver: d?.ownerDriver || false,
            }
          : t
      )
    );
    return submit('POST', `/trips/${tripId}/assign`, { driverId, fare }, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? (entity as CabTrip) : t)));
      },
      rollback: () => {
        if (prevTrip) setTrips((prev) => prev.map((t) => (t.id === tripId ? prevTrip : t)));
      },
    });
  };

  // Own-driver trip actions apply an optimistic status, then reconcile with the saved server trip
  const ownTripAction = async (tripId: number, path: string, body: any, local: (t: CabTrip) => CabTrip): Promise<ActionOutcome> => {
    const prevTrip = trips.find((t) => t.id === tripId);
    setTrips((prev) => prev.map((t) => (t.id === tripId ? local(t) : t)));
    return submit('POST', `/trips/${tripId}/${path}`, body, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? (entity as CabTrip) : t)));
      },
      rollback: () => {
        if (prevTrip) setTrips((prev) => prev.map((t) => (t.id === tripId ? prevTrip : t)));
      },
    });
  };

  const quoteTrip = (tripId: number, driverId: number, quotedFare: number) =>
    ownTripAction(tripId, 'quote', { driverId, quotedFare }, (t) => ({
      ...t,
      status: 'QUOTE_RECEIVED',
      quotes: [
        ...(t.quotes || []).filter((q) => q.driverId !== driverId),
        { driverId, driverName: drivers.find((x) => x.id === driverId)?.name || `Driver #${driverId}`, quotedFare, status: 'PENDING' },
      ],
    }));

  // The fare comes from the chosen quote on the server, never from the client. Queued offline like
  // every other mutation; the confirmed trip is returned only when the server accepted it.
  const confirmTripQuote = async (
    tripId: number,
    driverId: number | string
  ): Promise<ActionOutcome & { trip?: CabTrip }> => {
    let confirmed: CabTrip | undefined;
    const outcome = await submit('POST', `/trips/${tripId}/confirm-quote`, { driverId }, {
      applyServer: (entity) => {
        if (entity?.id) {
          confirmed = entity as CabTrip;
          setTrips((prev) => prev.map((t) => (t.id === tripId ? confirmed! : t)));
        }
      },
    });
    if (outcome.synced && !confirmed) {
      // 2xx without an id is a protocol error: nothing was optimistically changed, just report it
      return { ok: false, synced: false, error: 'Server did not return the confirmed trip.' };
    }
    return confirmed ? { ...outcome, trip: confirmed } : outcome;
  };

  const dispatchTrip = (tripId: number): Promise<ActionOutcome> =>
    submit('POST', `/trips/${tripId}/dispatch`, {}, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? (entity as CabTrip) : t)));
      },
    });

  const acceptTrip = (tripId: number) =>
    ownTripAction(tripId, 'accept', {}, (t) => ({ ...t, status: 'CONFIRMED' }));

  const reassignTrip = (tripId: number) =>
    ownTripAction(tripId, 'reassign', {}, (t) => ({ ...t, status: 'FINDING_DRIVER', driverId: null, driverName: null }));

  // Owner actions below are for own-driver trips; the server refuses them on platform trips (409)
  const startTrip = (tripId: number) =>
    ownTripAction(tripId, 'start', {}, (t) => ({ ...t, status: 'TRIP_STARTED' }));

  // Own-driver trip: the owner records the final fare; the server returns the saved trip (no commission)
  const completeTrip = async (tripId: number, finalFare?: number): Promise<ActionOutcome> => {
    const prevTrip = trips.find((t) => t.id === tripId);
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, status: 'COMPLETED', fare: finalFare ?? t.fare } : t))
    );
    return submit('POST', `/trips/${tripId}/complete`, finalFare ? { finalFare } : {}, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...(entity as CabTrip), platform: false } : t)));
      },
      rollback: () => {
        if (prevTrip) setTrips((prev) => prev.map((t) => (t.id === tripId ? prevTrip : t)));
      },
    });
  };

  const cancelTrip = async (tripId: number, reason?: string): Promise<ActionOutcome> => {
    const prevTrip = trips.find((t) => t.id === tripId);
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'CANCELLED' } : t)));
    return submit('POST', `/trips/${tripId}/cancel`, { reason: reason || 'Cancelled by homestay' }, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? (entity as CabTrip) : t)));
      },
      rollback: () => {
        if (prevTrip) setTrips((prev) => prev.map((t) => (t.id === tripId ? prevTrip : t)));
      },
    });
  };

  // D5: owner rates the platform driver once per completed platform trip (server answers 409 otherwise)
  const rateTrip = (tripId: number, stars: number, comment?: string): Promise<ActionOutcome> =>
    submit('POST', `/trips/${tripId}/rate`, comment ? { stars, comment } : { stars }, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? (entity as CabTrip) : t)));
      },
    });

  // ------------------------- Platform driver actions (by reference, server-confirmed) -------------------------

  const refreshDriverTrips = async () => {
    const list = await api.get('/driver/trips');
    if (Array.isArray(list)) setDriverTrips(list);
  };

  // Platform-driver writes go through the outbox too: offline they queue, and the driver's trip
  // list is only refreshed when the server actually accepted the change.
  const driverQuote = async (reference: string, quotedFare: number, notes?: string): Promise<ActionOutcome> => {
    const outcome = await submit('POST', `/driver/trips/${encodeURIComponent(reference)}/quote`, {
      quotedFare,
      notes: notes || '',
    });
    if (outcome.synced) await refreshDriverTrips().catch(() => {});
    return outcome;
  };

  const driverAcceptCounter = async (reference: string): Promise<ActionOutcome> => {
    const outcome = await submit('POST', `/driver/trips/${encodeURIComponent(reference)}/accept-counter`, {});
    if (outcome.synced) await refreshDriverTrips().catch(() => {});
    return outcome;
  };

  const counterOffer = (tripId: number, driverId: number | string, fare: number): Promise<ActionOutcome> =>
    submit('POST', `/trips/${tripId}/counter`, { driverId: String(driverId), fare }, {
      applyServer: (entity) => {
        if (entity?.id) setTrips((prev) => prev.map((t) => (t.id === tripId ? (entity as CabTrip) : t)));
      },
    });

  const driverStartTrip = async (reference: string, otp?: string): Promise<ActionOutcome> => {
    const cleanOtp = String(otp || '').trim();
    const currentTrip = driverTrips.find((t) => t.reference === reference);

    const outcome = await submit('POST', `/driver/trips/${encodeURIComponent(reference)}/start`, { otp: cleanOtp });
    if (outcome.ok) {
      if (outcome.synced) await refreshDriverTrips().catch(() => {});
      return outcome;
    }

    // Mountain Dead-Zone Offline Fallback:
    // When offline in a deep river gorge / hill homestay, verify the 4-digit PIN against the locally cached trip.
    if (!outcome.synced) {
      if (currentTrip?.pickupOtp && cleanOtp === String(currentTrip.pickupOtp).trim()) {
        // Correct PIN! Update local state optimistically and queue mutation for background replay
        setDriverTrips((prev) =>
          prev.map((t) =>
            t.reference === reference
              ? { ...t, status: 'TRIP_STARTED' as any, _pendingStartOtp: cleanOtp }
              : t
          )
        );
        await outbox.enqueue('POST', `/driver/trips/${encodeURIComponent(reference)}/start`, { otp: cleanOtp }).catch(() => {});
        return { ok: true, synced: false };
      }
      if (currentTrip?.pickupOtp && cleanOtp !== String(currentTrip.pickupOtp).trim()) {
        return { ok: false, synced: false, error: 'Invalid Boarding Verification PIN. Please ask the passenger for their 4-digit PIN.' };
      }
    }

    return outcome;
  };

  const driverCompleteTrip = async (reference: string): Promise<ActionOutcome> => {
    const currentTrip = driverTrips.find((t) => t.reference === reference);
    const outcome = await submit('POST', `/driver/trips/${encodeURIComponent(reference)}/complete`, {});
    if (outcome.ok) {
      if (outcome.synced) await refreshDriverTrips().catch(() => {});
      return outcome;
    }

    // Mountain Dead-Zone Offline Fallback:
    // Allow driver to complete trip upon cash collection in low-signal dropoff zones, queuing the completion for server sync
    if (!outcome.synced && currentTrip) {
      setDriverTrips((prev) =>
        prev.map((t) =>
          t.reference === reference
            ? { ...t, status: 'COMPLETED' as any, _pendingComplete: true }
            : t
        )
      );
      await outbox.enqueue('POST', `/driver/trips/${encodeURIComponent(reference)}/complete`, {}).catch(() => {});
      return { ok: true, synced: false };
    }

    return outcome;
  };

  const bookDriver = async (data: {
    guestName: string;
    phone: string;
    pickup: string;
    destination: string;
    date: number;
    time: string;
    passengers: number;
    vehicleType: VehicleType;
    pickupLat?: number;
    pickupLng?: number;
    driverId: number;
    fare: number;
    destinations?: CabTrip['destinations'];
    isRoundTrip?: boolean;
    returnDate?: number;
    returnTime?: string;
  }) => {
    const d = drivers.find((drv) => drv.id === data.driverId) || networkDrivers.find((drv) => drv.id === data.driverId);
    const id = nextIds.trip;
    const estFare = estimateFare(data.vehicleType);
    const t: CabTrip = {
      id,
      guestName: data.guestName,
      phone: data.phone,
      pickup: data.pickup,
      destination: data.destination,
      destinations: data.destinations,
      isRoundTrip: data.isRoundTrip,
      returnDate: data.returnDate,
      returnTime: data.returnTime,
      date: data.date,
      time: data.time,
      passengers: data.passengers,
      vehicleType: data.vehicleType,
      estFare,
      status: 'CONFIRMED',
      driverId: data.driverId,
      driverName: d ? d.name : null,
      ownerDriver: d ? d.ownerDriver : false,
      fare: 0,
      commission: 0,
      commissionPaid: false,
    };
    setTrips((prev) => [t, ...prev]);
    setNextIds((prev) => ({ ...prev, trip: prev.trip + 1 }));
    // Decision: this flow is a live 3-step handshake (create → assign → accept) that must run on the
    // SERVER-assigned trip id, so the later steps cannot be queued offline (they would carry a local
    // id the server never knows). It therefore stays awaited and direct, but is failure-safe:
    //  - any step failing rolls back the optimistic local trip (never a half-created local trip),
    //  - a partially created server trip is best-effort cancelled so it does not linger half-set-up,
    //  - the error is always rethrown, so the caller never reports success.
    let created: CabTrip | null = null;
    try {
      created = await api.post('/trips', tripRequestBody({ ...data, dispatchMode: 'OWN_DRIVER' }));
      if (!created?.id) throw new Error('Server did not return the saved trip.');
      // The server prices it (StayRide's own-fleet fee = guest advance) and messages guest and driver
      const assigned = await api.post(`/trips/${created.id}/assign`, { driverId: data.driverId, fare: data.fare });
      const finalTrip: CabTrip = assigned?.id ? assigned : created;
      setTrips((prev) => prev.map((item) => (item === t ? finalTrip : item)));
      return finalTrip;
    } catch (e) {
      setTrips((prev) => prev.filter((item) => item !== t));
      if (created?.id) {
        try {
          await api.post(`/trips/${created.id}/cancel`, { reason: 'Booking setup failed' });
        } catch (cleanup) {
          // Cleanup is best-effort: if the server is unreachable, the next sync() adopts the
          // partial server trip so the owner still sees the truth instead of a silent gap.
          console.warn('[StayRide] partial trip cleanup failed:', cleanup);
        }
        sync().catch(() => {});
      }
      throw e;
    }
  };

  // ------------------------- Campaign Actions -------------------------

  const createCampaign = async (
    titleOrData: string | { title: string; message: string; audience: Campaign['audience']; recipients?: number },
    msgParam?: string,
    audParam?: Campaign['audience']
  ) => {
    const id = nextIds.campaign;
    let title = '';
    let message = '';
    let audience: Campaign['audience'] = 'All guests';
    let recipients = 0;

    if (typeof titleOrData === 'object') {
      title = titleOrData.title;
      message = titleOrData.message;
      audience = titleOrData.audience;
      recipients = titleOrData.recipients || (audience === 'Repeat guests' ? guests.filter((g) => g.visits > 1).length : guests.length);
    } else {
      title = titleOrData;
      message = msgParam || '';
      audience = audParam || 'All guests';
      recipients =
        audience === 'All guests'
          ? guests.length
          : audience === 'Repeat guests'
          ? guests.filter((g) => g.visits > 1).length
          : 0; // server computes the real count
    }

    const c: Campaign = {
      id,
      title,
      message,
      audience,
      status: 'CREATED',
      recipients,
      sent: 0,
      failed: 0,
      createdOn: Date.now(),
    };
    setCampaigns((prev) => [c, ...prev]);
    setNextIds((prev) => ({ ...prev, campaign: prev.campaign + 1 }));
    let serverC: Campaign | undefined;
    const outcome = await submit('POST', '/campaigns', { title, message, audience }, {
      applyServer: (entity) => {
        if (entity?.id) {
          serverC = entity as Campaign;
          setCampaigns((prev) => prev.map((item) => (item === c ? (entity as Campaign) : item)));
        }
      },
      rollback: () => setCampaigns((prev) => prev.filter((item) => item !== c)),
    });
    if (!outcome.ok) throw new Error(outcome.error || 'Could not save the campaign.');
    return serverC ?? c;
  };

  // Server only marks the campaign as sent; no WhatsApp delivery happens yet
  const sendCampaign = async (id: number): Promise<ActionOutcome> => {
    const prevCampaign = campaigns.find((c) => c.id === id);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'SENDING' } : c)));
    return submit('POST', `/campaigns/${id}/send`, undefined, {
      applyServer: (entity) => {
        if (entity?.id) setCampaigns((prev) => prev.map((c) => (c.id === id ? (entity as Campaign) : c)));
      },
      rollback: () => {
        if (prevCampaign) setCampaigns((prev) => prev.map((c) => (c.id === id ? prevCampaign : c)));
      },
    });
  };

  // Server issues an opaque, expiring link; never build guest links client-side
  const createGuestLink = async (data: { guestId?: number; guestName: string; guestPhone: string }) => {
    const res = await api.post('/guest-links', data);
    if (!res?.url) throw new Error('Server did not return a guest link.');
    return res as { url: string; expiresAt: number };
  };

  // The server builds the message and sends it; the owner's phone/WhatsApp is never involved
  const askGuestForCab = async (data: { guestId?: number; guestName: string; guestPhone: string }) => {
    const res = await api.post('/guest-links/send', data);
    if (!res?.status) throw new Error('Server did not confirm the message.');
    return res as { sent: boolean; status: 'SENT' | 'SKIPPED'; nativeLink?: string; url?: string };
  };

  // ------------------------- Profile & Auth Actions -------------------------

  // Shown at once; rolled back if the server refuses it
  const setHomestayLocation = (loc: { latitude: number; longitude: number; address?: string }): Promise<ActionOutcome> => {
    const prevHomestay = homestay;
    setHomestay((prev) => ({ ...prev, latitude: loc.latitude, longitude: loc.longitude, ...(loc.address ? { location: loc.address } : {}) }));
    return submit('PUT', '/homestay/location', loc, {
      applyServer: (entity) => {
        if (entity) setHomestay((prev) => ({ ...prev, ...(entity as Partial<Homestay>) }));
      },
      rollback: () => setHomestay(prevHomestay),
    });
  };

  const updateHomestay = async (data: Partial<Homestay>): Promise<ActionOutcome> => {
    const prevHomestay = homestay;
    setHomestay((prev) => ({ ...prev, ...data }));
    return submit('PUT', '/homestay', data, {
      applyServer: (entity) => {
        if (entity) setHomestay((prev) => ({ ...prev, ...(entity as Partial<Homestay>) }));
      },
      rollback: () => setHomestay(prevHomestay),
    });
  };

  const login = async (email: string, pass: string) => {
    genRef.current++;
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = pass.trim();
    const isDemoHost =
      DEMO_ENABLED &&
      cleanEmail === 'demo@stayride.in' && (cleanPass === 'demo123' || cleanPass === 'demo');
    const isDemoDriver =
      DEMO_ENABLED &&
      (cleanEmail === 'driver@stayride.in' || cleanEmail === 'demo-driver@stayride.in') &&
      (cleanPass === 'demo123' || cleanPass === 'demo');

    if (isDemoDriver) {
      try {
        const res = await api.post('/auth/login', { email: cleanEmail, password: cleanPass });
        await api.saveSession(res);
        applySession(res);
      } catch (e) {
        // The server answered but rejected the demo login (demo disabled / bad credentials):
        // surface it instead of faking a session that can never sync.
        if (e instanceof ApiError) throw e;
        // Server unreachable — safe offline demo session for showcasing the app without a backend.
        const demoDriverSession: UserSession = {
          accessToken: 'demo-driver-token-' + Date.now(),
          refreshToken: 'demo-driver-refresh-' + Date.now(),
          role: 'driver',
          driver: {
            id: 1,
            name: 'Pemba Lepcha (Demo Driver)',
            phone: '+91 98000 11223',
            email: cleanEmail,
            vehicle: 'Mahindra Scorpio (SUV)',
            vehicleType: 'SUV',
            plate: 'SK-01-A-4488',
            available: true,
            active: true,
            area: 'Gangtok & North Sikkim',
            status: 'ACTIVE',
          },
        };
        await api.saveSession(demoDriverSession);
        applySession(demoDriverSession);
      }
      await loadDemoShowcase();
      return;
    }

    if (isDemoHost) {
      try {
        const res = await api.post('/auth/login', { email: cleanEmail, password: cleanPass });
        await api.saveSession(res);
        applySession(res);
      } catch (e) {
        // Server rejected the demo login (demo disabled / bad credentials): surface it rather than
        // faking a session that can never reach the backend.
        if (e instanceof ApiError) throw e;
        // Server unreachable — safe offline demo session for showcasing app without local server
        const demoSession: UserSession = {
          accessToken: 'demo-token-' + Date.now(),
          refreshToken: 'demo-refresh-' + Date.now(),
          role: 'owner',
          owner: {
            id: 1,
            name: 'Tshering Bhutia (Demo)',
            phone: '+91 98320 11223',
            email: 'demo@stayride.in',
          },
          homestay: {
            id: 1,
            name: 'Mountain View Homestay',
            link: `${process.env.EXPO_PUBLIC_WEB_URL || ''}/h/mountain-view-gangtok`,
          },
        };
        await api.saveSession(demoSession);
        applySession(demoSession);
      }
      await loadDemoShowcase();
      return;
    }

    // Real production user: strictly authenticate with the backend
    try {
      const res = await api.post('/auth/login', { email: cleanEmail, password: cleanPass });
      if (res?.role === 'admin' || res?.user?.role === 'admin') {
        await api.clearSession();
        throw new Error('Access Denied: You are an Administrator. The mobile app is strictly for Homestay Hosts and Cab Drivers. Please use the Web Control Tower.');
      }
      await api.saveSession(res);
      applySession(res);
      setIsDemoMode(false);

      if (res?.role === 'driver') {
        await sync();
        return;
      }

      // Hydrate local state for this specific host user
      const key = getStorageKey(cleanEmail);
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setRooms(parsed.rooms || []);
          setGuests(parsed.guests || []);
          setBookings(parsed.bookings || []);
          setDrivers(parsed.drivers || []);
          setNetworkDrivers(parsed.networkDrivers || []);
          setTrips(parsed.trips || []);
          setDriverTrips(parsed.driverTrips || []);
          setCampaigns(parsed.campaigns || []);
          setHomestay(parsed.homestay || {});
        } catch {}
      } else {
        await initFreshWorkspace({
          name: res?.homestay?.name || '',
          ownerName: res?.owner?.name || '',
          phone: res?.owner?.phone || '',
          email: cleanEmail,
        });
      }

      await sync();
    } catch (e: any) {
      throw new Error(e.message || 'Login failed. Please check your credentials or server connection.');
    }
  };

  // `message` is shown after a forced sign out (internal use only)
  const signOutLocal = async (message?: string) => {
    // Remove this device's push token while the session can still authenticate the call
    if (api.isLoggedIn() && !isOfflineDemo()) unregisterPush(); // fire-and-forget; the token is read synchronously
    genRef.current++;
    pushTriedRef.current = false;
    setPushEnabled(false);
    api.clearIdempotencyKeys();
    // Clear the session ref first so nothing below persists into the outgoing user's cache
    applySession(null);
    await api.clearSession();
    setIsDemoMode(false);
    setRooms([]);
    setGuests([]);
    setBookings([]);
    setDrivers([]);
    setNetworkDrivers([]);
    setTrips([]);
    setCampaigns([]);
    setHomestay({} as Homestay);
    setCommissionRates(null);
    setFeatures(null);
    setAccountBlock(null);
    setDriverTrips([]);
    setPayoutSummary(null);
    await initFreshWorkspace();
    if (message) Alert.alert('Signed out', message);
  };
  const logout = () => signOutLocal();

  const logoutAllDevices = async (): Promise<ActionOutcome> => {
    if (isOfflineDemo()) {
      await logout();
      return { ok: true, synced: true };
    }
    await unregisterPush(); // must run before the token version is bumped
    try {
      await api.post('/auth/logout-all');
    } catch (e: any) {
      pushTriedRef.current = false; // re-register on the next sync since we are still signed in
      return { ok: false, synced: false, error: e instanceof ApiError ? e.message : 'No connection to server. Please try again.' };
    }
    await logout();
    return { ok: true, synced: true };
  };

  const syncClerkUser = async (
    clerkUser: any,
    clerkToken: string,
    extras?: {
      homestayName?: string;
      location?: string;
      phone?: string;
      name?: string;
      email?: string;
      role?: 'owner' | 'driver' | 'admin';
      vehicleType?: string;
      vehicleNumber?: string;
      area?: string;
      latitude?: number;
      longitude?: number;
      mapQuery?: string;
      acceptedTerms?: boolean; // new accounts: Terms + Privacy accepted, 18+ confirmed
    }
  ) => {
    if (!clerkUser) return;
    genRef.current++;
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses?.[0]?.emailAddress ||
      extras?.email ||
      '';
    const name =
      extras?.name ||
      clerkUser.fullName ||
      clerkUser.firstName ||
      (email ? email.split('@')[0] : '');
    const phone =
      clerkUser.primaryPhoneNumber?.phoneNumber ||
      clerkUser.phoneNumbers?.[0]?.phoneNumber ||
      extras?.phone ||
      '';

    try {
      // Server derives identity from the verified Clerk token; body carries profile extras
      const res = await api.post(
        '/auth/clerk-sync',
        {
          phone,
          homestayName: extras?.homestayName,
          location: extras?.location,
          role: extras?.role || 'owner',
          vehicleType: extras?.vehicleType,
          vehicleNumber: extras?.vehicleNumber,
          area: extras?.area,
          latitude: extras?.latitude,
          longitude: extras?.longitude,
          mapQuery: extras?.mapQuery,
          acceptedTerms: extras?.acceptedTerms === true,
        },
        clerkToken
      );
      if (res?.role === 'admin' || extras?.role === 'admin') {
        await api.clearSession();
        throw new Error('Access Denied: You are an Administrator. The mobile app is strictly for Homestay Hosts and Cab Drivers. Please use the Web Control Tower.');
      }

      await api.saveSession(res);
      applySession(res);
      setIsDemoMode(false);

      if (res?.role === 'driver') {
        await sync();
        setBackendStatus('connected');
        return;
      }

      if (res.isNew) {
        await initFreshWorkspace({
          name: extras?.homestayName || '',
          ownerName: name,
          phone,
          email,
          location: extras?.location,
        });
      } else {
        const key = getStorageKey(res?.owner?.email || email);
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setRooms(parsed.rooms || []);
            setGuests(parsed.guests || []);
            setBookings(parsed.bookings || []);
            setDrivers(parsed.drivers || []);
            setNetworkDrivers(parsed.networkDrivers || []);
            setTrips(parsed.trips || []);
            setDriverTrips(parsed.driverTrips || []);
            setCampaigns(parsed.campaigns || []);
            setHomestay(parsed.homestay || {});
          } catch {}
        } else {
          await initFreshWorkspace({
            name: res?.homestay?.name || '',
            ownerName: res?.owner?.name || name,
            phone,
            email,
          });
        }
      }

      await sync();
      setBackendStatus('connected');
    } catch (err: any) {
      console.error('[StayRide] syncClerkUser error:', err);
      throw err;
    }
  };


  return (
    <StayRideContext.Provider
      value={{
        rooms: roomsView,
        guests,
        bookings,
        drivers,
        networkDrivers,
        trips,
        campaigns,
        homestay,
        commissionRates,
        features: isOfflineDemo()
          ? { campaigns: true, guestCabLinks: true, platformDispatch: true, payouts: true, driverQuotes: true }
          : features,
        accountBlock,
        driverTrips,
        payoutSummary,
        pushEnabled,
        refreshPayoutSummary,
        requestFeature,
        session,
        loading,
        syncing,
        backendStatus,
        isDemoMode,

        todayBookings,
        currentGuestCount,
        availableRoomCount,
        monthRevenue,
        occupancyPercent,
        commissionEarned,
        totalBookings,
        recentBookings,
        upcomingCheckIns,
        recentTrips,
        countRooms,
        countGuests,
        searchGuests,
        getChartData,

        sync,
        outboxCount,
        createBooking,
        checkInBooking,
        checkOutBooking,
        cancelBooking,
        setBookingPaid,
        changeBookingRoom,
        editBooking,
        counterOffer,
        driverAcceptCounter,
        setHomestayLocation,
        addPayment,
        removePayment,
        getRoomCalendar,
        setRoomCalendarLinks,
        syncRoomCalendar,

        createRoom,
        updateRoom,
        deleteRoom,

        createGuest,
        updateGuest,
        deleteGuest,

        createDriver,
        updateDriver,
        setDriverAvailability,
        setDriverOnline,
        setDriverActive,
        deleteDriver,

        createTrip,
        assignTripDriver,
        reportDriverLocation,
        config,
        quoteTrip,
        confirmTripQuote,
        dispatchTrip,
        acceptTrip,
        reassignTrip,
        startTrip,
        completeTrip,
        cancelTrip,
        rateTrip,
        driverQuote,
        driverStartTrip,
        driverCompleteTrip,
        bookDriver,

        createCampaign,
        sendCampaign,
        createGuestLink,
        askGuestForCab,

        updateHomestay,

        login,
        logout,
        logoutAllDevices,
        syncClerkUser,
      }}
    >
      {children}
    </StayRideContext.Provider>
  );
};

export const useStayRide = () => {
  const ctx = useContext(StayRideContext);
  if (!ctx) throw new Error('useStayRide must be used within StayRideProvider');
  return ctx;
};
