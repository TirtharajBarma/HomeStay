"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NewBookingDraft } from "@/components/new-booking-dialog";
import {
  addDays,
  buildDays,
  defaultStart,
  getSchedule,
  isSameDay,
  rangeCaption,
  rangeLabel,
  WINDOW_DAYS,
} from "@/lib/calendar-window";
import type { Day, Reservation, Room, RoomGroup } from "@/lib/calendar-data";

export type CalendarView = "timeline" | "month" | "list";

/** Reservations are addressed by key so edits and renders stay in sync. */
export function reservationKey(room: Room, reservation: Reservation) {
  return `${room.code}|${reservation.guest}`;
}

export type Selection = {
  room: Room;
  groupTitle: string;
  reservation: Reservation;
  startDate: Date;
};

export type Amendment = { start?: number; nights?: number };

type CalendarState = {
  view: CalendarView;
  setView: (view: CalendarView) => void;
  start: Date;
  days: Day[];
  groups: RoomGroup[];
  label: string;
  caption: string;
  todayIndex: number;
  shift: (delta: number) => void;
  goToToday: () => void;
  isToday: boolean;
  selected: Selection | null;
  select: (room: Room, reservation: Reservation) => void;
  clearSelection: () => void;
  selectedKey: string | null;
  amend: (key: string, changes: Amendment) => void;
  addWalkIn: (draft: NewBookingDraft) => void;
  reservations: { room: Room; groupTitle: string; reservation: Reservation }[];
};

const CalendarContext = createContext<CalendarState | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<CalendarView>("timeline");
  const [start, setStart] = useState<Date>(defaultStart);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Walk-ins added in this session, keyed by window start + room code.
  const [extras, setExtras] = useState<Record<string, Reservation[]>>({});
  // Date changes applied to a reservation, keyed by room + guest.
  const [amendments, setAmendments] = useState<Record<string, Amendment>>({});

  const baseGroups = useMemo(() => getSchedule(start), [start]);

  const groups = useMemo<RoomGroup[]>(() => {
    const windowKey = start.toISOString();
    return baseGroups.map((group) => ({
      ...group,
      rooms: group.rooms.map((room) => {
        const added = extras[`${windowKey}|${room.code}`] ?? [];
        const reservations = [
          ...room.reservations.map((reservation) => {
            const change = amendments[reservationKey(room, reservation)];
            return change ? { ...reservation, ...change } : reservation;
          }),
          ...added,
        ];
        return reservations.length === room.reservations.length
          ? room
          : { ...room, reservations };
      }),
    }));
  }, [baseGroups, extras, amendments, start]);

  // The compiler already memoizes this lookup, so keep it as plain code.
  const selected: Selection | null = (() => {
    if (!selectedKey) return null;
    for (const group of groups) {
      for (const room of group.rooms) {
        for (const reservation of room.reservations) {
          if (reservationKey(room, reservation) === selectedKey) {
            return { room, groupTitle: group.title, reservation, startDate: start };
          }
        }
      }
    }
    return null;
  })();

  const days = useMemo(() => buildDays(start, groups), [start, groups]);

  const shift = useCallback((delta: number) => {
    setStart((current) => addDays(current, delta * WINDOW_DAYS));
  }, []);

  const goToToday = useCallback(() => {
    setStart(defaultStart);
    setView("timeline");
  }, []);

  const select = useCallback((room: Room, reservation: Reservation) => {
    setSelectedKey(reservationKey(room, reservation));
  }, []);
  const clearSelection = useCallback(() => setSelectedKey(null), []);

  const amend = useCallback((key: string, changes: Amendment) => {
    setAmendments((current) => ({ ...current, [key]: { ...current[key], ...changes } }));
  }, []);

  const addWalkIn = useCallback(
    (draft: NewBookingDraft) => {
      const checkIn = new Date(`${draft.checkIn}T00:00:00`);
      if (Number.isNaN(checkIn.getTime())) return;
      const offset = Math.round(
        (checkIn.getTime() - start.getTime()) / 86_400_000,
      );
      if (offset < 0 || offset >= WINDOW_DAYS) return;
      const nights = Math.max(
        1,
        Math.round(
          (new Date(`${draft.checkOut}T00:00:00`).getTime() - checkIn.getTime()) /
            86_400_000,
        ),
      );
      const channel =
        draft.source === "Direct"
          ? "direct"
          : draft.source === "Airbnb"
            ? "airbnb"
            : "ota";
      const reservation: Reservation = {
        guest: draft.guest.trim(),
        start: offset,
        nights,
        channel,
        tag: draft.source === "Booking.com" ? "Booking" : draft.source,
        detail: `${nights} nts • ${draft.guests} guest${draft.guests === 1 ? "" : "s"} • ${
          nights * 195
        }`,
        emphasis: offset === 0,
      };
      setExtras((current) => {
        // The draft's unit is addressed by name, so resolve it to the room in view.
        const target =
          groups
            .flatMap((group) => group.rooms)
            .find((room) => room.name === draft.room) ??
          groups[0]?.rooms[0];
        if (!target) return current;
        const key = `${start.toISOString()}|${target.code}`;
        return { ...current, [key]: [...(current[key] ?? []), reservation] };
      });
      setSelectedKey(null);
    },
    [start, groups],
  );

  const reservations = useMemo(
    () =>
      groups.flatMap((group) =>
        group.rooms.flatMap((room) =>
          room.reservations.map((reservation) => ({
            room,
            groupTitle: group.title,
            reservation,
          })),
        ),
      ),
    [groups],
  );

  const value = useMemo<CalendarState>(
    () => ({
      view,
      setView,
      start,
      days,
      groups,
      label: rangeLabel(start),
      caption: rangeCaption(start),
      todayIndex: isSameDay(start, defaultStart) ? 6 : -1,
      shift,
      goToToday,
      isToday: isSameDay(start, defaultStart),
      selected,
      select,
      clearSelection,
      selectedKey,
      amend,
      addWalkIn,
      reservations,
    }),
    [
      view,
      start,
      days,
      groups,
      selected,
      selectedKey,
      shift,
      goToToday,
      select,
      clearSelection,
      amend,
      addWalkIn,
      reservations,
    ],
  );

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarState {
  const context = useContext(CalendarContext);
  if (!context) throw new Error("useCalendar must be used inside <CalendarProvider>");
  return context;
}
