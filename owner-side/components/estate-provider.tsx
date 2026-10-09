"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { drivers as seedDrivers, type Driver, type DriverStatus } from "@/lib/drivers-data";
import { createPersistedStore, type PersistedStore } from "@/lib/persisted-store";
import { roomUnits, type RoomUnit } from "@/lib/rooms-data";
import { API_ENDPOINTS } from "@/lib/api-config";

export type EstateRoom = RoomUnit;
export type EstateDriver = Driver;

export type EstateBooking = {
  id: string;
  code: string;
  room: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  party: number;
  channel: string;
  notes: string;
  total: number;
  createdAt: number;
};

export type EstateProfile = {
  name: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  town: string;
  region: string;
  postal: string;
  bio: string;
  checkInTime: string;
  checkOutTime: string;
  responseTime: string;
};

export type EstateLocation = {
  id: string;
  name: string;
  address: string;
  kind: string;
  units: number;
  note: string;
  /** Dropped pin — the source of truth for where this location actually is. */
  lat: number | null;
  lng: number | null;
};

/** Bookings written before `notes`/`total` existed get safe defaults. */
const reviveBookings = (parsed: unknown): EstateBooking[] =>
  (Array.isArray(parsed) ? (parsed as EstateBooking[]) : []).map((row) => ({
    ...row,
    notes: row.notes ?? "",
    party: row.party || 1,
  }));

const seedProfile: EstateProfile = {
  name: "Ananya Rai",
  role: "Estate Owner & Host",
  email: "ananya@gumtreevalley.in",
  phone: "+91 98300 41000",
  address: "12 Ging Tea Estate Road",
  town: "Darjeeling",
  region: "West Bengal",
  postal: "734101",
  bio: "I run Gumtree Valley with my brother Arjun — six units across the Ging lodge, the Chiyabari lofts and two garden cottages. I answer every guest message myself, and I would rather over-communicate than disappoint anyone.",
  checkInTime: "3:00 PM",
  checkOutTime: "11:00 AM",
  responseTime: "Usually within 20 minutes",
};

const seedLocations: EstateLocation[] = [
  {
    id: "LOC-1",
    name: "Ging Lodge",
    address: "12 Ging Tea Estate Road, Darjeeling, West Bengal 734101",
    kind: "Main lodge",
    units: 2,
    note: "Ground floor suites with direct terrace access to the tea gardens.",
    lat: 27.03677,
    lng: 88.26302,
  },
  {
    id: "LOC-2",
    name: "Chiyabari Lofts",
    address: "14 Ging Tea Estate Road, Darjeeling, West Bengal 734101",
    kind: "Loft block",
    units: 2,
    note: "Timber lofts above the factory, full Himalaya panorama.",
    lat: 27.03781,
    lng: 88.26177,
  },
  {
    id: "LOC-3",
    name: "Garden Cottages",
    address: "18–22 Ging Tea Estate Road, Darjeeling, West Bengal 734101",
    kind: "Cottages",
    units: 2,
    note: "Secluded cottages — Silver Oak and Cardamom Hills.",
    lat: 27.03512,
    lng: 88.26514,
  },
];

const KEYS = {
  rooms: "estate-rooms",
  drivers: "estate-drivers",
  bookings: "estate-bookings",
  profile: "estate-profile",
  locations: "estate-locations",
} as const;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

/** `Driver.joined` is the only `Date` in a persisted slice — restore it after JSON. */
function reviveDrivers(parsed: unknown): EstateDriver[] {
  if (!Array.isArray(parsed)) return seedDrivers;
  return parsed.map((driver: EstateDriver) => ({
    ...driver,
    joined: new Date(driver.joined),
  }));
}

/** Reads and writes one persisted slice through `useSyncExternalStore`. */
function usePersisted<T>(store: PersistedStore<T>) {
  const value = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  const set = useCallback((next: T | ((current: T) => T)) => store.set(next), [store]);
  return [value, set] as const;
}

type EstateContextValue = {
  rooms: EstateRoom[];
  addRoom: (room: Omit<EstateRoom, "code"> & { code?: string }) => EstateRoom;
  updateRoom: (code: string, patch: Partial<EstateRoom>) => void;
  removeRoom: (code: string) => void;

  drivers: EstateDriver[];
  addDriver: (driver: Omit<EstateDriver, "id" | "trips" | "commission" | "joined" | "rating">) => EstateDriver;
  updateDriver: (id: string, patch: Partial<EstateDriver>) => void;
  removeDriver: (id: string) => void;

  bookings: EstateBooking[];
  addBooking: (booking: Omit<EstateBooking, "id" | "createdAt" | "total">) => EstateBooking;
  removeBooking: (id: string) => void;

  profile: EstateProfile;
  updateProfile: (patch: Partial<EstateProfile>) => void;

  locations: EstateLocation[];
  addLocation: (location: Omit<EstateLocation, "id">) => EstateLocation;
  updateLocation: (id: string, patch: Partial<EstateLocation>) => void;
  removeLocation: (id: string) => void;

  reset: () => void;
};

const EstateContext = createContext<EstateContextValue | null>(null);

export function EstateProvider({ children }: { children: ReactNode }) {
  const [roomStore, driverStore, bookingStore, profileStore, locationStore] = useMemo(
    () => [
      createPersistedStore<EstateRoom[]>(KEYS.rooms, roomUnits),
      createPersistedStore<EstateDriver[]>(KEYS.drivers, seedDrivers, reviveDrivers),
      createPersistedStore<EstateBooking[]>(KEYS.bookings, [], reviveBookings),
      createPersistedStore<EstateProfile>(KEYS.profile, seedProfile),
      createPersistedStore<EstateLocation[]>(KEYS.locations, seedLocations),
    ],
    [],
  );

  const [rooms, setRooms] = usePersisted(roomStore);
  const [drivers, setDrivers] = usePersisted(driverStore);
  const [bookings, setBookings] = usePersisted(bookingStore);
  const [profile, setProfile] = usePersisted(profileStore);
  const [locations, setLocations] = usePersisted(locationStore);

  // Real-time synchronization from live Node/MongoDB backend
  useEffect(() => {
    let cancelled = false;
    async function syncBackend() {
      try {
        const [roomsRes, driversRes, bookingsRes, profileRes] = await Promise.allSettled([
          fetch(API_ENDPOINTS.rooms.list()).then((r) => r.json()),
          fetch(API_ENDPOINTS.drivers.list()).then((r) => r.json()),
          fetch(API_ENDPOINTS.bookings.list()).then((r) => r.json()),
          fetch(API_ENDPOINTS.properties.profile()).then((r) => r.json()),
        ]);

        if (cancelled) return;

        if (roomsRes.status === "fulfilled" && roomsRes.value?.success && roomsRes.value?.data?.length) {
          setRooms(roomsRes.value.data);
        }
        if (driversRes.status === "fulfilled" && driversRes.value?.success && driversRes.value?.data?.length) {
          setDrivers(
            driversRes.value.data.map((d: any) => ({
              ...d,
              joined: d.joined ? new Date(d.joined) : new Date(2024, 9, 24),
            }))
          );
        }
        if (bookingsRes.status === "fulfilled" && bookingsRes.value?.success && bookingsRes.value?.data?.length) {
          setBookings(
            bookingsRes.value.data.map((b: any) => ({
              id: b.reference || b._id,
              code: b.roomCode,
              room: b.roomName,
              guest: b.guestName,
              checkIn: b.checkIn,
              checkOut: b.checkOut,
              party: b.party || 1,
              channel: b.channel || "Direct",
              notes: b.notes || "",
              total: b.totalAmount || b.roomTotal || 0,
              createdAt: new Date(b.createdAt).getTime() || Date.now(),
            }))
          );
        }
        if (profileRes.status === "fulfilled" && profileRes.value?.success && profileRes.value?.data) {
          const p = profileRes.value.data;
          setProfile({
            name: p.name,
            role: p.role,
            email: p.email,
            phone: p.phone,
            address: p.address,
            town: p.town,
            region: p.region,
            postal: p.postal,
            bio: p.bio,
            checkInTime: p.checkInTime,
            checkOutTime: p.checkOutTime,
            responseTime: p.responseTime,
          });
          if (p.locations?.length) {
            setLocations(p.locations);
          }
        }
      } catch (err) {
        console.warn("Could not sync from backend:", err);
      }
    }
    syncBackend();
    return () => {
      cancelled = true;
    };
  }, [setRooms, setDrivers, setBookings, setProfile, setLocations]);

  const addRoom = useCallback<EstateContextValue["addRoom"]>(
    (room) => {
      const created: EstateRoom = {
        ...room,
        code: room.code || nextId("RM").toUpperCase(),
      };
      setRooms((current) => [...current, created]);
      fetch(API_ENDPOINTS.rooms.create(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(created),
      }).catch((e) => console.warn("Background room sync notice:", e));
      return created;
    },
    [setRooms],
  );

  const updateRoom = useCallback(
    (code: string, patch: Partial<EstateRoom>) => {
      setRooms((current) =>
        current.map((room) => (room.code === code ? { ...room, ...patch } : room)),
      );
      fetch(API_ENDPOINTS.rooms.update(code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch((e) => console.warn("Background room update sync notice:", e));
    },
    [setRooms],
  );

  const removeRoom = useCallback(
    (code: string) => {
      setRooms((current) => current.filter((room) => room.code !== code));
      fetch(API_ENDPOINTS.rooms.delete(code), {
        method: "DELETE",
      }).catch((e) => console.warn("Background room delete sync notice:", e));
    },
    [setRooms],
  );

  const addDriver = useCallback<EstateContextValue["addDriver"]>(
    (driver) => {
      const created: EstateDriver = {
        ...driver,
        id: nextId("DRV"),
        rating: 5,
        trips: 0,
        commission: 0,
        joined: new Date(2024, 9, 24),
      };
      setDrivers((current) => [...current, created]);
      fetch(API_ENDPOINTS.drivers.create(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(created),
      }).catch((e) => console.warn("Background driver sync notice:", e));
      return created;
    },
    [setDrivers],
  );

  const updateDriver = useCallback(
    (id: string, patch: Partial<EstateDriver>) => {
      setDrivers((current) =>
        current.map((driver) => (driver.id === id ? { ...driver, ...patch } : driver)),
      );
      if (patch.status) {
        fetch(API_ENDPOINTS.drivers.updateStatus(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: patch.status }),
        }).catch((e) => console.warn("Background driver status sync notice:", e));
      }
    },
    [setDrivers],
  );

  const removeDriver = useCallback(
    (id: string) => {
      setDrivers((current) => current.filter((driver) => driver.id !== id));
      fetch(API_ENDPOINTS.drivers.updateStatus(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Inactive" }),
      }).catch((e) => console.warn("Background driver remove sync notice:", e));
    },
    [setDrivers],
  );

  const addBooking = useCallback<EstateContextValue["addBooking"]>(
    (booking) => {
      const nights = Math.max(
        1,
        Math.round(
          (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) /
            86_400_000,
        ),
      );
      const room = rooms.find((entry) => entry.code === booking.code);
      const rate = room?.nightly ?? 180;
      const created: EstateBooking = {
        ...booking,
        id: nextId("GV"),
        createdAt: Date.now(),
        total: nights * rate + 750 + Math.round(nights * rate * 0.04),
      };
      setBookings((current) => [created, ...current]);

      // Sync booking to backend MongoDB
      fetch(API_ENDPOINTS.bookings.create(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: booking.code,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: booking.party || 1,
          firstName: booking.guest.split(" ")[0] || booking.guest,
          lastName: booking.guest.split(" ").slice(1).join(" ") || "Guest",
          email: `${booking.guest.toLowerCase().replace(/[^a-z0-9]/g, ".")}@example.com`,
          phone: "+91 98300 00000",
          channel: booking.channel || "direct",
          notes: booking.notes || "",
        }),
      }).catch((e) => console.warn("Background booking sync notice:", e));

      return created;
    },
    [rooms, setBookings],
  );

  const removeBooking = useCallback(
    (id: string) => {
      setBookings((current) => current.filter((booking) => booking.id !== id));
      fetch(API_ENDPOINTS.bookings.cancel(id), {
        method: "PATCH",
      }).catch((e) => console.warn("Background booking cancel sync notice:", e));
    },
    [setBookings],
  );

  const updateProfile = useCallback(
    (patch: Partial<EstateProfile>) => {
      setProfile((current) => ({ ...current, ...patch }));
      fetch(API_ENDPOINTS.properties.profile(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch((e) => console.warn("Background profile sync notice:", e));
    },
    [setProfile],
  );

  const addLocation = useCallback<EstateContextValue["addLocation"]>(
    (location) => {
      const created: EstateLocation = { ...location, id: nextId("LOC") };
      setLocations((current) => [...current, created]);
      fetch(API_ENDPOINTS.properties.locations(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      }).catch((e) => console.warn("Background location add sync notice:", e));
      return created;
    },
    [setLocations],
  );

  const updateLocation = useCallback(
    (id: string, patch: Partial<EstateLocation>) => {
      setLocations((current) =>
        current.map((location) => (location.id === id ? { ...location, ...patch } : location)),
      );
      fetch(API_ENDPOINTS.properties.location(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch((e) => console.warn("Background location update sync notice:", e));
    },
    [setLocations],
  );

  const removeLocation = useCallback(
    (id: string) => {
      setLocations((current) => current.filter((location) => location.id !== id));
      fetch(API_ENDPOINTS.properties.location(id), {
        method: "DELETE",
      }).catch((e) => console.warn("Background location delete sync notice:", e));
    },
    [setLocations],
  );

  const reset = useCallback(() => {
    for (const store of [roomStore, driverStore, bookingStore, profileStore, locationStore]) {
      store.clear();
    }
  }, [roomStore, driverStore, bookingStore, profileStore, locationStore]);

  const value = useMemo<EstateContextValue>(
    () => ({
      rooms,
      addRoom,
      updateRoom,
      removeRoom,
      drivers,
      addDriver,
      updateDriver,
      removeDriver,
      bookings,
      addBooking,
      removeBooking,
      profile,
      updateProfile,
      locations,
      addLocation,
      updateLocation,
      removeLocation,
      reset,
    }),
    [
      rooms,
      addRoom,
      updateRoom,
      removeRoom,
      drivers,
      addDriver,
      updateDriver,
      removeDriver,
      bookings,
      addBooking,
      removeBooking,
      profile,
      updateProfile,
      locations,
      addLocation,
      updateLocation,
      removeLocation,
      reset,
    ],
  );

  return <EstateContext.Provider value={value}>{children}</EstateContext.Provider>;
}

export function useEstate(): EstateContextValue {
  const value = useContext(EstateContext);
  if (!value) throw new Error("useEstate must be used inside <EstateProvider>");
  return value;
}

export const locationKinds = ["Main lodge", "Barn", "Cottages", "Cabins", "Off-site"];

export const driverStatusOptions: DriverStatus[] = [
  "Active",
  "On a trip",
  "Invited",
  "Paused",
];
