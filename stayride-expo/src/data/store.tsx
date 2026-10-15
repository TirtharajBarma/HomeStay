import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
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
} from '../types';
import { generateSeedData, todayMidnight, DAY_MS } from './seeder';
import { api } from './api';

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
  session: UserSession | null;
  loading: boolean;
  syncing: boolean;
  backendStatus: 'checking' | 'connected' | 'offline';

  // Computed metrics
  todayBookings: () => Booking[];
  currentGuestCount: () => number;
  availableRoomCount: () => number;
  monthRevenue: () => number;
  occupancyPercent: () => number;
  commissionEarned: () => number;
  commissionPending: () => number;
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
  createBooking: (data: Omit<Booking, 'id' | 'status'> & { paid?: boolean }) => Promise<Booking>;
  checkInBooking: (id: number) => Promise<void>;
  checkOutBooking: (id: number) => Promise<void>;
  cancelBooking: (id: number) => Promise<void>;
  setBookingPaid: (id: number, paid: boolean) => Promise<void>;
  changeBookingRoom: (id: number, roomNumber: string) => Promise<void>;

  createRoom: (data: Omit<Room, 'id'>) => Promise<Room>;
  updateRoom: (id: number, data: Partial<Room>) => Promise<void>;
  deleteRoom: (id: number) => Promise<void>;

  createGuest: (data: Omit<Guest, 'id' | 'visits' | 'totalSpending' | 'firstVisit' | 'lastVisit'>) => Promise<Guest>;
  updateGuest: (id: number, data: Partial<Guest>) => Promise<void>;
  deleteGuest: (id: number) => Promise<void>;

  createDriver: (data: Omit<Driver, 'id' | 'ownerDriver' | 'active'>) => Promise<Driver>;
  updateDriver: (id: number, data: Partial<Driver>) => Promise<void>;
  setDriverAvailability: (id: number, available: boolean) => Promise<void>;
  setDriverActive: (id: number, active: boolean) => Promise<void>;
  deleteDriver: (id: number) => Promise<void>;

  createTrip: (data: Omit<CabTrip, 'id' | 'status' | 'driverId' | 'driverName' | 'ownerDriver' | 'fare' | 'commission' | 'commissionPaid' | 'estFare'>) => Promise<CabTrip>;
  assignTripDriver: (tripId: number, driverId: number) => Promise<void>;
  quoteTrip: (tripId: number, driverId: number, quotedFare: number) => Promise<void>;
  confirmTripQuote: (tripId: number, driverId: number, agreedFare: number) => Promise<CabTrip>;
  acceptTrip: (tripId: number) => Promise<void>;
  reassignTrip: (tripId: number) => Promise<void>;
  startTrip: (tripId: number) => Promise<void>;
  completeTrip: (tripId: number, finalFare?: number) => Promise<void>;
  cancelTrip: (tripId: number) => Promise<void>;
  payCommission: (tripId: number, paid: boolean) => Promise<void>;
  bookDriver: (data: {
    guestName: string;
    phone: string;
    pickup: string;
    destination: string;
    date: number;
    time: string;
    passengers: number;
    vehicleType: VehicleType;
    driverId: number;
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
  sendCampaign: (id: number) => Promise<void>;
  createGuestLink: (data: { guestId?: number; guestName: string; guestPhone: string }) => Promise<{ url: string; expiresAt: number }>;

  updateHomestay: (data: Partial<Homestay>) => Promise<void>;
  isDemoMode: boolean;

  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  syncClerkUser: (
    clerkUser: any,
    clerkToken: string,
    extras?: {
      homestayName?: string;
      location?: string;
      phone?: string;
      name?: string;
      email?: string;
      role?: 'owner' | 'driver';
      vehicleType?: string;
      vehicleNumber?: string;
      area?: string;
      latitude?: number;
      longitude?: number;
      mapQuery?: string;
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
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [networkDrivers, setNetworkDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<CabTrip[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [homestay, setHomestay] = useState<Homestay>({} as Homestay);
  const [commissionRates, setCommissionRates] = useState<CommissionRates | null>(null);
  const [nextIds, setNextIds] = useState({ room: 10, guest: 20, booking: 100, driver: 20, trip: 20, campaign: 10 });

  const [isDemoMode, setIsDemoMode] = useState(false);

  // Refs so async code (persist, sync, timers) never reads a stale session from a closure
  const sessionRef = useRef<UserSession | null>(null);
  // Bumped on login/logout/clerk sync; async results from an older generation are dropped
  const genRef = useRef(0);
  const applySession = (s: UserSession | null) => {
    sessionRef.current = s;
    setSession(s);
  };
  // Offline demo session is fabricated locally; never send it to the server
  const isOfflineDemo = () => Boolean(api.getSession()?.accessToken?.startsWith('demo-token-'));

  // Helper to isolate local cache by user email
  const getStorageKey = (email?: string) => {
    const clean = (email || '').toLowerCase().trim();
    return clean ? `stayride_local_db_${clean.replace(/[^a-z0-9]/g, '_')}` : 'stayride_local_db_guest';
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
      const isDemoAccount = userEmail?.toLowerCase().trim() === 'demo@stayride.in';
      const key = getStorageKey(userEmail);

      const localData = await AsyncStorage.getItem(key);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);

          // If local data was in demo mode, but current user is NOT the demo account, clear to fresh workspace
          if (!isDemoAccount && parsed.isDemoMode) {
            await initFreshWorkspace();
          } else {
            setRooms(parsed.rooms || []);
            setGuests(parsed.guests || []);
            setBookings(parsed.bookings || []);
            setDrivers(parsed.drivers || []);
            setNetworkDrivers(parsed.networkDrivers || []);
            setTrips(parsed.trips || []);
            setCampaigns(parsed.campaigns || []);
            setHomestay(parsed.homestay || {});
            setIsDemoMode(Boolean(parsed.isDemoMode) && isDemoAccount);
            setNextIds(parsed.nextIds || { room: 10, guest: 20, booking: 100, driver: 20, trip: 20, campaign: 10 });
          }
        } catch {
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
        sync().catch(() => {});
      }
    }
    bootstrap();
    return api.onSessionExpired(() => {
      logout().catch(() => {});
    });
  }, []);

  const initFreshWorkspace = async (info?: Partial<Homestay>) => {
    const freshHomestay: Homestay = {
      name: info?.name || 'My Homestay',
      description: info?.description || 'Peaceful mountain retreat nestled in the hills.',
      location: info?.location || 'Gangtok, Sikkim',
      phone: info?.phone || '',
      email: info?.email || '',
      ownerName: info?.ownerName || 'Host',
      link: info?.link || `https://stayride.in/h/${(info?.name || 'homestay').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      mapQuery: info?.location || '',
      amenities: ['Free Wi-Fi', 'Hot Water', 'Home Cooked Meals', 'Power Backup'],
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
    try {
      const email = customEmail !== undefined ? customEmail : sessionRef.current?.owner?.email;
      const key = getStorageKey(email);
      await AsyncStorage.setItem(key, JSON.stringify(all));
    } catch {}
  }

  // Auto-save on state change
  useEffect(() => {
    if (!loading) {
      persist({ rooms, guests, bookings, drivers, networkDrivers, trips, campaigns, homestay, isDemoMode, nextIds });
    }
  }, [rooms, guests, bookings, drivers, networkDrivers, trips, campaigns, homestay, isDemoMode, nextIds, loading]);

  // Sync with real backend using high-speed /snapshot aggregator
  const sync = async () => {
    const gen = genRef.current;
    const isLive = await api.checkHealth();
    if (gen !== genRef.current) return;
    setBackendStatus(isLive ? 'connected' : 'offline');
    if (!isLive || !api.isLoggedIn() || isOfflineDemo()) return;
    setSyncing(true);
    try {
      const snap = await api.get('/snapshot');
      if (gen !== genRef.current) return; // user changed while this sync was in flight
      if (snap) {
        if (snap.homestay) setHomestay(snap.homestay);
        if (Array.isArray(snap.rooms)) setRooms(snap.rooms);
        if (Array.isArray(snap.guests)) setGuests(snap.guests);
        if (Array.isArray(snap.bookings)) setBookings(snap.bookings);
        if (Array.isArray(snap.drivers)) setDrivers(snap.drivers);
        if (Array.isArray(snap.networkDrivers)) setNetworkDrivers(snap.networkDrivers);
        if (Array.isArray(snap.trips)) setTrips(snap.trips);
        if (Array.isArray(snap.campaigns)) setCampaigns(snap.campaigns);
        if (snap.commissionRates) setCommissionRates(snap.commissionRates);
      }
      setBackendStatus('connected');
    } catch (e) {
      // Fallback silently to offline store
      if (gen === genRef.current) setBackendStatus('offline');
    } finally {
      setSyncing(false);
    }
  };

  // Fire-and-forget server write: on failure tell the user and reload server truth
  const remote = (call: () => Promise<any>) => {
    if (isOfflineDemo()) return;
    call().catch((e: any) => {
      Alert.alert('Not saved', e?.message || 'Could not save your change. Please try again.');
      sync().catch(() => {});
    });
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
    return rooms.filter((r) => r.status === 'AVAILABLE').length;
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
    const occupied = rooms.filter((r) => r.status === 'OCCUPIED' || r.status === 'RESERVED').length;
    return Math.round((occupied * 100) / rooms.length);
  };

  const commissionEarned = () => {
    return trips
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.commission || 0), 0);
  };

  const commissionPending = () => {
    return trips
      .filter((t) => t.status === 'COMPLETED' && !t.commissionPaid)
      .reduce((sum, t) => sum + (t.commission || 0), 0);
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
    return rooms.filter((r) => r.status === status).length;
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
            .filter((t) => t.status === 'COMPLETED' && t.date >= dayStart && t.date < dayEnd)
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
            .filter((t) => t.status === 'COMPLETED' && t.date >= wStart && t.date < wEnd)
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
          .filter((t) => t.status === 'COMPLETED' && t.date >= mStart && t.date < mEnd)
          .reduce((sum, t) => sum + (t.commission || 0), 0);
      }
      values.push(val);
    }
    return { labels, values };
  };

  // ------------------------- Booking Actions -------------------------

  const createBooking = async (data: Omit<Booking, 'id' | 'status'> & { paid?: boolean }) => {
    // Prevent overlapping bookings on the same room
    const requestedCheckIn = Number(data.checkIn);
    const requestedCheckOut = Number(data.checkOut);
    const hasCollision = bookings.some((b) => {
      if (b.roomNumber !== data.roomNumber || b.status === 'CANCELLED') return false;
      return requestedCheckIn < b.checkOut && requestedCheckOut > b.checkIn;
    });

    if (hasCollision) {
      throw new Error(
        `Room ${data.roomNumber} is already booked for these dates (${new Date(requestedCheckIn).toLocaleDateString()} to ${new Date(requestedCheckOut).toLocaleDateString()}). Please select different dates or a different room.`
      );
    }

    const id = nextIds.booking;
    const newBk: Booking = { ...data, id, status: 'CONFIRMED', paid: Boolean(data.paid) };
    const prevRoomStatus = rooms.find((r) => r.number === data.roomNumber)?.status;
    setBookings((prev) => [newBk, ...prev]);
    setNextIds((prev) => ({ ...prev, booking: prev.booking + 1 }));

    // Set room to RESERVED
    setRooms((prev) =>
      prev.map((r) => (r.number === data.roomNumber ? { ...r, status: 'RESERVED' } : r))
    );

    // Call API and adopt authoritative server response; on failure undo and re-throw
    if (isOfflineDemo()) return newBk;
    try {
      const serverBk = await api.post('/bookings', data);
      if (!serverBk?.id) throw new Error('Server did not return the saved booking.');
      setBookings((prev) => prev.map((b) => (b === newBk ? serverBk : b)));
      return serverBk;
    } catch (e) {
      setBookings((prev) => prev.filter((b) => b !== newBk));
      if (prevRoomStatus) {
        setRooms((prev) =>
          prev.map((r) => (r.number === data.roomNumber ? { ...r, status: prevRoomStatus } : r))
        );
      }
      throw e;
    }
  };

  const checkInBooking = async (id: number) => {
    let targetRoom = '';
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          targetRoom = b.roomNumber;
          return { ...b, status: 'CHECKED_IN' };
        }
        return b;
      })
    );
    if (targetRoom) {
      setRooms((prev) =>
        prev.map((r) => (r.number === targetRoom ? { ...r, status: 'OCCUPIED' } : r))
      );
    }
    remote(() => api.post(`/bookings/${id}/check-in`));
  };

  const checkOutBooking = async (id: number) => {
    let targetRoom = '';
    let guestId = 0;
    let amount = 0;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          targetRoom = b.roomNumber;
          guestId = b.guestId;
          amount = b.amount;
          return { ...b, status: 'CHECKED_OUT' };
        }
        return b;
      })
    );
    if (targetRoom) {
      setRooms((prev) =>
        prev.map((r) => (r.number === targetRoom ? { ...r, status: 'AVAILABLE' } : r))
      );
    }
    if (guestId) {
      setGuests((prev) =>
        prev.map((g) =>
          g.id === guestId
            ? {
                ...g,
                visits: g.visits + 1,
                totalSpending: g.totalSpending + amount,
                lastVisit: Date.now(),
              }
            : g
        )
      );
    }
    remote(() => api.post(`/bookings/${id}/check-out`));
  };

  const cancelBooking = async (id: number) => {
    let targetRoom = '';
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          targetRoom = b.roomNumber;
          return { ...b, status: 'CANCELLED' };
        }
        return b;
      })
    );
    if (targetRoom) {
      setRooms((prev) =>
        prev.map((r) => (r.number === targetRoom ? { ...r, status: 'AVAILABLE' } : r))
      );
    }
    remote(() => api.post(`/bookings/${id}/cancel`));
  };

  const setBookingPaid = async (id: number, paid: boolean) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, paid } : b)));
    remote(() => api.patch(`/bookings/${id}/payment`, { paid }));
  };

  const changeBookingRoom = async (id: number, roomNumber: string) => {
    let oldRoom = '';
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          oldRoom = b.roomNumber;
          return { ...b, roomNumber };
        }
        return b;
      })
    );
    setRooms((prev) =>
      prev.map((r) => {
        if (r.number === oldRoom) return { ...r, status: 'AVAILABLE' };
        if (r.number === roomNumber) return { ...r, status: 'RESERVED' };
        return r;
      })
    );
    remote(() => api.post(`/bookings/${id}/room`, { roomNumber }));
  };

  // ------------------------- Rooms Actions -------------------------

  const createRoom = async (data: Omit<Room, 'id'>) => {
    const id = nextIds.room;
    const r: Room = { ...data, id };
    setRooms((prev) => [...prev, r]);
    setNextIds((prev) => ({ ...prev, room: prev.room + 1 }));
    if (isOfflineDemo()) return r;
    try {
      const serverR = await api.post('/rooms', data);
      if (!serverR?.id) throw new Error('Server did not return the saved record.');
      setRooms((prev) => prev.map((item) => (item === r ? serverR : item)));
      return serverR;
    } catch (e) {
      setRooms((prev) => prev.filter((item) => item !== r));
      throw e;
    }
  };

  const updateRoom = async (id: number, data: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    remote(() => api.put(`/rooms/${id}`, data));
  };

  const deleteRoom = async (id: number) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    remote(() => api.delete(`/rooms/${id}`));
  };

  // ------------------------- Guest Actions -------------------------

  const createGuest = async (data: any) => {
    const id = nextIds.guest;
    const g: Guest = {
      ...data,
      id,
      visits: data.visits || 1,
      totalSpending: data.totalSpending || 0,
      firstVisit: Date.now(),
      lastVisit: Date.now(),
    };
    setGuests((prev) => [g, ...prev]);
    setNextIds((prev) => ({ ...prev, guest: prev.guest + 1 }));
    if (isOfflineDemo()) return g;
    try {
      const serverG = await api.post('/guests', data);
      if (!serverG?.id) throw new Error('Server did not return the saved record.');
      setGuests((prev) => prev.map((item) => (item === g ? serverG : item)));
      return serverG;
    } catch (e) {
      setGuests((prev) => prev.filter((item) => item !== g));
      throw e;
    }
  };

  const updateGuest = async (id: number, data: Partial<Guest>) => {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
    remote(() => api.put(`/guests/${id}`, data));
  };

  const deleteGuest = async (id: number) => {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    remote(() => api.delete(`/guests/${id}`));
  };

  // ------------------------- Driver Actions -------------------------

  const createDriver = async (data: any) => {
    const id = nextIds.driver;
    const d: Driver = { ...data, id, available: true, active: true, ownerDriver: true };
    setDrivers((prev) => [...prev, d]);
    setNextIds((prev) => ({ ...prev, driver: prev.driver + 1 }));
    if (isOfflineDemo()) return d;
    try {
      const serverD = await api.post('/drivers', data);
      if (!serverD?.id) throw new Error('Server did not return the saved record.');
      setDrivers((prev) => prev.map((item) => (item === d ? serverD : item)));
      return serverD;
    } catch (e) {
      setDrivers((prev) => prev.filter((item) => item !== d));
      throw e;
    }
  };

  const updateDriver = async (id: number, data: Partial<Driver>) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
    remote(() => api.put(`/drivers/${id}`, data));
  };

  const setDriverAvailability = async (id: number, available: boolean) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, available } : d)));
    remote(() => api.patch(`/drivers/${id}/availability`, { available }));
  };

  const setDriverActive = async (id: number, active: boolean) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, active } : d)));
    remote(() => api.patch(`/drivers/${id}/active`, { active }));
  };

  const deleteDriver = async (id: number) => {
    setDrivers((prev) => prev.filter((d) => d.id !== id));
    remote(() => api.delete(`/drivers/${id}`));
  };

  // ------------------------- Trip Actions -------------------------

  const estimateFare = (vehicleType: string) => {
    if (vehicleType === 'SUV') return 3000;
    if (vehicleType === '7-seater') return 3200;
    if (vehicleType === '9-seater') return 4200;
    return 2200; // Sedan
  };

  // POST /trips accepts only these fields; anything else (source, assignedDriver*) stays local
  const tripRequestBody = (d: any) => ({
    guestName: d.guestName,
    phone: d.phone,
    pickup: d.pickup,
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
    };
    setTrips((prev) => [t, ...prev]);
    setNextIds((prev) => ({ ...prev, trip: prev.trip + 1 }));
    if (isOfflineDemo()) return t;
    try {
      const serverT = await api.post('/trips', tripRequestBody(data));
      if (!serverT?.id) throw new Error('Server did not return the saved record.');
      setTrips((prev) => prev.map((item) => (item === t ? serverT : item)));
      return serverT;
    } catch (e) {
      setTrips((prev) => prev.filter((item) => item !== t));
      throw e;
    }
  };

  const assignTripDriver = async (tripId: number, driverId: number) => {
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
    remote(() => api.post(`/trips/${tripId}/assign`, { driverId }));
  };

  const quoteTrip = async (tripId: number, driverId: number, quotedFare: number) => {
    const allDrivers = [...drivers, ...networkDrivers];
    const d = allDrivers.find((x) => x.id === driverId);
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          const existingQuotes = t.quotes || [];
          return {
            ...t,
            status: 'QUOTE_RECEIVED',
            quotes: [
              ...existingQuotes.filter((q) => q.driverId !== driverId),
              {
                driverId,
                driverName: d?.name || `Driver #${driverId}`,
                quotedFare,
                status: 'PENDING',
              },
            ],
          };
        }
        return t;
      })
    );
    remote(() => api.post(`/trips/${tripId}/quote`, { driverId, quotedFare }));
  };

  // Awaits the server: fare split and advance come from the server's financialSnapshot
  const confirmTripQuote = async (tripId: number, driverId: number, agreedFare: number) => {
    if (isOfflineDemo()) throw new Error('Confirming a driver needs a server connection.');
    const updated: CabTrip = await api.post(`/trips/${tripId}/confirm-quote`, { driverId, agreedFare });
    if (!updated?.id) throw new Error('Server did not return the confirmed trip.');
    setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
    return updated;
  };

  const acceptTrip = async (tripId: number) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'CONFIRMED' } : t)));
    remote(() => api.post(`/trips/${tripId}/accept`));
  };

  const reassignTrip = async (tripId: number) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, status: 'FINDING_DRIVER', driverId: null, driverName: null } : t
      )
    );
    remote(() => api.post(`/trips/${tripId}/reassign`));
  };

  const startTrip = async (tripId: number) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'TRIP_STARTED' } : t)));
    remote(() => api.post(`/trips/${tripId}/start`));
  };

  const completeTrip = async (tripId: number, finalFare?: number) => {
    let computedFare = finalFare;
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          const fare = finalFare || t.fare || t.estFare || 3000;
          computedFare = fare;
          // Commission is server-computed; the server response below replaces this trip
          return { ...t, status: 'COMPLETED', fare };
        }
        return t;
      })
    );
    if (isOfflineDemo()) return;
    try {
      const updated = await api.post(`/trips/${tripId}/complete`, { finalFare: computedFare });
      if (updated && updated.id) {
        setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
      }
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Could not complete the trip. Please try again.');
      sync().catch(() => {});
    }
  };

  const cancelTrip = async (tripId: number) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'CANCELLED' } : t)));
    remote(() => api.post(`/trips/${tripId}/cancel`));
  };

  const setCommissionPaid = async (tripId: number, paid: boolean) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, commissionPaid: paid } : t)));
    remote(() => api.post(`/trips/${tripId}/commission/pay`, { paid }));
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
    driverId: number;
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
    if (isOfflineDemo()) return t;
    // Create the request, then assign + accept on the SERVER id so the driver is kept
    let created: CabTrip | null = null;
    try {
      created = await api.post('/trips', tripRequestBody(data));
      if (!created?.id) throw new Error('Server did not return the saved trip.');
      await api.post(`/trips/${created.id}/assign`, { driverId: data.driverId });
      const accepted = await api.post(`/trips/${created.id}/accept`);
      const finalTrip: CabTrip = accepted?.id ? accepted : created;
      setTrips((prev) => prev.map((item) => (item === t ? finalTrip : item)));
      return finalTrip;
    } catch (e) {
      setTrips((prev) => prev.filter((item) => item !== t));
      if (created?.id) sync().catch(() => {}); // partial server trip exists; show it
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
          : 6;
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
    if (isOfflineDemo()) return c;
    try {
      const serverC = await api.post('/campaigns', { title, message, audience });
      if (!serverC?.id) throw new Error('Server did not return the saved record.');
      setCampaigns((prev) => prev.map((item) => (item === c ? serverC : item)));
      return serverC;
    } catch (e) {
      setCampaigns((prev) => prev.filter((item) => item !== c));
      throw e;
    }
  };

  // Server only marks the campaign as sent; no WhatsApp delivery happens yet
  const sendCampaign = async (id: number) => {
    if (isOfflineDemo()) throw new Error('Sending a campaign needs a server connection.');
    const updated = await api.post(`/campaigns/${id}/send`);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? (updated?.id ? updated : { ...c, status: 'COMPLETED' }) : c)));
  };

  // Server issues an opaque, expiring link; never build guest links client-side
  const createGuestLink = async (data: { guestId?: number; guestName: string; guestPhone: string }) => {
    if (isOfflineDemo()) throw new Error('Guest links need a server connection.');
    const res = await api.post('/guest-links', data);
    if (!res?.url) throw new Error('Server did not return a guest link.');
    return res as { url: string; expiresAt: number };
  };

  // ------------------------- Profile & Auth Actions -------------------------

  // Awaits the server so callers can report success or failure honestly
  const updateHomestay = async (data: Partial<Homestay>) => {
    if (!isOfflineDemo()) await api.put('/homestay', data);
    setHomestay((prev) => ({ ...prev, ...data }));
  };

  const login = async (email: string, pass: string) => {
    genRef.current++;
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = pass.trim();
    const isDemoHost =
      cleanEmail === 'demo@stayride.in' && (cleanPass === 'demo123' || cleanPass === 'demo');
    const isDemoDriver =
      (cleanEmail === 'driver@stayride.in' || cleanEmail === 'demo-driver@stayride.in') &&
      (cleanPass === 'demo123' || cleanPass === 'demo');

    if (isDemoDriver) {
      try {
        const res = await api.post('/auth/login', { email: cleanEmail, password: cleanPass });
        await api.saveSession(res);
        applySession(res);
      } catch {
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
            rating: 4.9,
            available: true,
            active: true,
            area: 'Gangtok & North Sikkim',
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
      } catch {
        // Safe offline demo session fallback for showcasing app without local server
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
            link: 'https://stayride.in/h/mountain-view-gangtok',
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
          setCampaigns(parsed.campaigns || []);
          setHomestay(parsed.homestay || {});
        } catch {}
      } else {
        await initFreshWorkspace({
          name: res?.homestay?.name || 'My Homestay',
          ownerName: res?.owner?.name || 'Host',
          phone: res?.owner?.phone || '',
          email: cleanEmail,
        });
      }

      await sync();
    } catch (e: any) {
      throw new Error(e.message || 'Login failed. Please check your credentials or server connection.');
    }
  };

  const logout = async () => {
    genRef.current++;
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
    await initFreshWorkspace();
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
      role?: 'owner' | 'driver';
      vehicleType?: string;
      vehicleNumber?: string;
      area?: string;
      latitude?: number;
      longitude?: number;
      mapQuery?: string;
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
      (email ? email.split('@')[0] : 'Host');
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
        },
        clerkToken
      );

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
          name: extras?.homestayName || `${name}'s Homestay`,
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
            setCampaigns(parsed.campaigns || []);
            setHomestay(parsed.homestay || {});
          } catch {}
        } else {
          await initFreshWorkspace({
            name: res?.homestay?.name || `${name}'s Homestay`,
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
        rooms,
        guests,
        bookings,
        drivers,
        networkDrivers,
        trips,
        campaigns,
        homestay,
        commissionRates,
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
        commissionPending,
        totalBookings,
        recentBookings,
        upcomingCheckIns,
        recentTrips,
        countRooms,
        countGuests,
        searchGuests,
        getChartData,

        sync,
        createBooking,
        checkInBooking,
        checkOutBooking,
        cancelBooking,
        setBookingPaid,
        changeBookingRoom,

        createRoom,
        updateRoom,
        deleteRoom,

        createGuest,
        updateGuest,
        deleteGuest,

        createDriver,
        updateDriver,
        setDriverAvailability,
        setDriverActive,
        deleteDriver,

        createTrip,
        assignTripDriver,
        quoteTrip,
        confirmTripQuote,
        acceptTrip,
        reassignTrip,
        startTrip,
        completeTrip,
        cancelTrip,
        payCommission: setCommissionPaid,
        bookDriver,

        createCampaign,
        sendCampaign,
        createGuestLink,

        updateHomestay,

        login,
        logout,
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
