"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AvailabilityGrid } from "@/components/book/availability-grid";
import { useEstate } from "@/components/estate-provider";
import { useAuth } from "@/components/auth-context";
import { Icon } from "@/components/icon";
import { PeriodNav } from "@/components/owner/period-nav";
import {
  PageHeader,
  PageShell,
  Panel,
  StatCard,
  fieldClass,
  labelClass,
  solidButton,
} from "@/components/owner/primitives";
import { RoomFormDialog } from "@/components/rooms/room-form-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useMoney } from "@/components/currency-provider";
import { API_ENDPOINTS } from "@/lib/api-config";
import { addDays, defaultStart, getSchedule } from "@/lib/calendar-window";
import { baseToday, isoDate, shortDate, windowCaption } from "@/lib/timeline";

const windows = [
  { key: "week", label: "7-day window", days: 7 },
  { key: "fortnight", label: "14-day window", days: 14 },
  { key: "month", label: "28-day window", days: 28 },
];

const sources = [
  "MakeMyTrip",
  "Goibibo",
  "Airbnb",
  "Booking.com",
  "Direct Website",
  "Phone / WhatsApp",
  "Walk-in",
];

type Step = "rooms" | "calendar" | "details";

type Draft = {
  room: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  /** Empty until typed; falls back to 1 guest on save. */
  guests: string;
  /** Empty until chosen; the select shows a placeholder option. */
  source: string;
  notes: string;
};

const steps: { key: Step; label: string; short: string; icon: string }[] = [
  { key: "rooms", label: "Choose rooms", short: "Rooms", icon: "meeting_room" },
  { key: "calendar", label: "Pick dates", short: "Dates", icon: "calendar_month" },
  { key: "details", label: "Guest & save", short: "Guest", icon: "how_to_reg" },
];

export function BookView() {
  const { money } = useMoney();
  const { user } = useAuth();
  const isDemo = !user || user.email === "owner@estate.com";
  const { rooms, bookings, addBooking } = useEstate();
  const { notify } = useToast();

  const [step, setStep] = useState<Step>("rooms");
  const [selected, setSelected] = useState<string[]>([]);
  const [windowKey, setWindowKey] = useState("fortnight");
  const [offset, setOffset] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [seed, setSeed] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    room: "",
    guestName: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    guests: "",
    source: "",
    notes: "",
  });

  const [shareModal, setShareModal] = useState<{
    booking: any;
    roomName: string;
    shareUrl: string;
    guestPhone: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // iCal sync modal state
  const [icalModalOpen, setIcalModalOpen] = useState(false);
  const [syncRoomCode, setSyncRoomCode] = useState<string>("");
  const [inboundIcalUrl, setInboundIcalUrl] = useState("");
  const [syncingIcal, setSyncingIcal] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copiedIcalFeed, setCopiedIcalFeed] = useState(false);

  const days = windows.find((entry) => entry.key === windowKey)?.days ?? 14;
  const start = addDays(defaultStart, offset * days);
  const caption = windowCaption(start, days);
  const schedule = useMemo(() => (isDemo ? getSchedule(start) : []), [start, isDemo]);

  const chosen = rooms.filter((room) => selected.includes(room.code));
  const shown = chosen.length ? chosen : rooms;

  const openCount = (code: string) => {
    const room = rooms.find((entry) => entry.code === code);
    if (!room || room.status === "Maintenance") return 0;
    let free = 0;
    for (let index = 0; index < days; index += 1) {
      const date = addDays(start, index);
      if (date < baseToday) continue;
      const held = schedule
        .flatMap((group) => group.rooms)
        .find((entry) => entry.code.replace(/\D/g, "") === code)
        ?.reservations.some(
          (reservation) =>
            index >= reservation.start && index < reservation.start + reservation.nights,
        );
      const iso = isoDate(date);
      const mine = bookings.some(
        (booking) => booking.code === code && booking.checkIn <= iso && booking.checkOut > iso,
      );
      if (!held && !mine) free += 1;
    }
    return free;
  };

  const openNights = rooms.reduce((sum, room) => sum + openCount(room.code), 0);
  const bookableRooms = rooms.filter((room) => room.status === "Active");

  const toggle = (code: string) =>
    setSelected((current) =>
      current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code],
    );

  /** Step 3 is seeded from whatever date the owner tapped in the calendar. */
  const openDetails = (roomName: string, checkIn: string) => {
    setDraft({
      room: roomName,
      guestName: "",
      guestPhone: "",
      checkIn,
      checkOut: "",
      guests: "",
      source: "",
      notes: "",
    });
    setStep("details");
  };

  const save = () => {
    const room = rooms.find((entry) => entry.name === draft.room);
    if (!room) return;
    if (draft.checkIn < baseTodayIso()) return;
    const created = addBooking({
      code: room.code,
      room: room.name,
      guest: draft.guestName.trim() || "Walk-in guest",
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      party,
      channel: draft.source || "Direct",
      notes: draft.notes.trim(),
    });
    notify(`${created.guest} booked into ${created.room} · ${money(created.total)}.`, {
      icon: "event_available",
      tone: "success",
    });

    const guestPhone = draft.guestPhone.trim();
    const roomSlug = (room as any).slug || room.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const clientBase =
      typeof window !== "undefined" && window.location.port === "3001"
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : "http://localhost:3000";
    const guestUrl = `${clientBase}/h/${roomSlug}?ref=${created.id}&checkIn=${created.checkIn}&checkOut=${created.checkOut}&guest=${encodeURIComponent(created.guest)}`;

    setShareModal({
      booking: created,
      roomName: room.name,
      shareUrl: guestUrl,
      guestPhone,
      guestName: created.guest,
      checkIn: created.checkIn,
      checkOut: created.checkOut,
    });

    const remaining = selected.filter((code) => code !== room.code);
    setSelected(remaining);
    setSeed((value) => value + 1);
    setStep(remaining.length ? "calendar" : "rooms");
    setDraft((current) => ({ ...current, guestName: "", guestPhone: "", notes: "" }));
  };

  const nights =
    draft.checkIn && draft.checkOut
      ? Math.max(
          1,
          Math.round(
            (new Date(`${draft.checkOut}T00:00:00`).getTime() -
              new Date(`${draft.checkIn}T00:00:00`).getTime()) /
              86_400_000,
          ),
        )
      : 0;

  const activeRoom = rooms.find((room) => room.name === draft.room);
  const estimate = activeRoom ? activeRoom.nightly * nights : 0;
  const party = Math.max(1, Number(draft.guests) || 1);
  const errors = {
    checkIn: !draft.checkIn,
    checkOut: !draft.checkOut || draft.checkOut <= draft.checkIn,
    past: Boolean(draft.checkIn && draft.checkIn < baseTodayIso()),
  };
  const canSave = !errors.checkIn && !errors.checkOut && !errors.past && Boolean(activeRoom);

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Homestay Operations"
        title="Book Rooms"
        description="Three short steps: choose the rooms, pick the dates, then confirm the guest."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (!syncRoomCode && rooms.length) setSyncRoomCode(rooms[0].code);
                setIcalModalOpen(true);
              }}
              className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-1.5 text-label-sm font-semibold text-on-surface shadow-xs transition-colors hover:bg-surface-container"
            >
              <Icon name="sync" className="text-[17px] text-primary" />
              <span>OTA Sync (Airbnb)</span>
            </button>
            {step === "calendar" || step === "details" ? (
              <PeriodNav
                options={windows.map((entry) => ({
                  ...entry,
                  hint: windowCaption(addDays(defaultStart, 0), entry.days),
                }))}
                value={windowKey}
                onChange={(key) => {
                  setWindowKey(key);
                  setOffset(0);
                }}
                onShift={(delta) => setOffset((current) => Math.min(0, current + delta))}
                caption={caption}
                atLatest={offset === 0}
                icon="calendar_month"
              />
            ) : (
              <button onClick={() => setAddOpen(true)} className={solidButton}>
                <Icon name="add_home" className="flex-shrink-0 text-[18px]" />
                Add room
              </button>
            )}
          </div>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="meeting_room" className="text-[15px] text-outline" />
              {rooms.length} rooms
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="event_available" className="text-[15px] text-outline" />
              {bookableRooms.length} bookable
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="today" className="text-[15px] text-outline" />
              {openNights} open nights in {caption.split(",")[0]}
            </span>
          </>
        }
      />

      {/* ---------------------------------------------------------- stepper */}
      <ol className="my-space-md flex flex-wrap items-center gap-2">
        {steps.map((entry, index) => {
          const currentIndex = steps.findIndex((item) => item.key === step);
          const state =
            entry.key === step ? "current" : index < currentIndex ? "done" : "todo";
          return (
            <li key={entry.key} className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <button
                onClick={() => {
                  if (entry.key === "rooms" || selected.length) setStep(entry.key);
                }}
                disabled={entry.key !== "rooms" && !selected.length}
                data-testid={`step-${entry.key}`}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors sm:flex-none ${
                  state === "current"
                    ? "border-primary bg-primary-tint text-primary"
                    : state === "done"
                      ? "border-outline-variant/50 bg-surface-container text-on-surface"
                      : "border-outline-variant/30 text-outline"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-label-sm text-label-sm ${
                    state === "done" ? "bg-primary text-on-primary" : "bg-surface-container-high"
                  }`}
                >
                  {state === "done" ? (
                    <Icon name="check" className="text-[14px]" />
                  ) : (
                    <Icon name={entry.icon} className="text-[15px]" />
                  )}
                </span>
                <span className="truncate text-label-sm text-label-sm font-semibold sm:text-label-md sm:text-label-md">
                  {entry.short}
                  <span className="hidden sm:inline"> {entry.label}</span>
                </span>
              </button>
              {index < steps.length - 1 ? (
                <Icon name="chevron_right" className="hidden flex-shrink-0 text-[18px] text-outline sm:block" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
        <StatCard
          label="Open nights"
          value={String(openNights)}
          icon="event_available"
          footnote={`Across ${days} days · ${caption}`}
        />
        <StatCard
          label="Rooms selected"
          value={String(selected.length)}
          icon="checklist"
          iconTone="bg-secondary-tint text-secondary-ink"
          footnote={
            selected.length
              ? chosen.map((room) => room.name).join(", ")
              : "Pick at least one room to continue"
          }
        />
        <StatCard
          label="Bookings saved"
          value={String(bookings.length)}
          icon="confirmation_number"
          iconTone="bg-tertiary-fixed text-on-tertiary-fixed"
          footnote={
            bookings.length
              ? `Latest: ${bookings[0].guest} · ${bookings[0].room}`
              : "Nothing booked from this page yet"
          }
        />
      </div>

      {/* ------------------------------------------------------ STEP 1: rooms */}
      {step === "rooms" ? (
        <div className="mt-space-lg">
          <Panel
            title="Choose the rooms to fill"
            icon="meeting_room"
            caption="Tick every room you want to open up for this booking"
            action={
              <>
                <button
                  onClick={() => setSelected([])}
                  className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-2.5 text-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container sm:py-1.5"
                >
                  <Icon name="close" className="text-[15px]" />
                  Clear
                </button>
                <button
                  onClick={() => setSelected(rooms.map((room) => room.code))}
                  className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-2.5 text-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container sm:py-1.5"
                >
                  <Icon name="select_all" className="text-[15px]" />
                  Select all
                </button>
              </>
            }
          >
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-outline">
                <Icon name="meeting_room" className="mb-2 text-4xl text-outline/50" />
                <p className="text-sm font-medium text-on-surface">No rooms added yet</p>
                <p className="mt-1 text-xs text-outline">
                  Add accommodation units in Rooms & Rates to open them for bookings.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {rooms.map((room) => {
                const isSelected = selected.includes(room.code);
                const free = openCount(room.code);
                const maintenance = room.status === "Maintenance";

                return (
                  <li key={room.code}>
                    <button
                      onClick={() => toggle(room.code)}
                      aria-pressed={isSelected}
                      data-testid={`pick-${room.code}`}
                      className={`flex w-full gap-3 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary-tint shadow-sm"
                          : "border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50"
                      }`}
                    >
                      <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={room.image}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-body-md text-body-md font-semibold text-on-surface sm:truncate">
                              {room.name}
                            </p>
                            <p className="truncate text-label-sm text-label-sm text-outline">
                              {room.code} · {room.category}
                            </p>
                          </div>
                          <span
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-on-primary"
                                : "border-outline-variant/50"
                            }`}
                          >
                            {isSelected ? <Icon name="check" className="text-[14px]" /> : null}
                          </span>
                        </div>

                        <p className="mt-auto text-label-sm text-label-sm text-on-surface-variant">
                          {maintenance ? (
                            <span className="font-semibold text-hold-ink">Maintenance hold</span>
                          ) : free > 0 ? (
                            <>
                              <strong className="font-semibold text-primary">{free}</strong> open
                              night{free === 1 ? "" : "s"}
                            </>
                          ) : (
                            <span className="font-semibold text-primary">Fully booked</span>
                          )}
                          <span className="text-outline"> · {money(room.nightly)}/night</span>
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-label-sm text-label-sm text-outline">
                {selected.length
                  ? `${selected.length} room${selected.length === 1 ? "" : "s"} ready — next you pick the dates.`
                  : "Select one or more rooms to continue."}
              </p>
              <button
                onClick={() => setStep("calendar")}
                disabled={!selected.length}
                data-testid="rooms-next"
                className={`${solidButton} justify-center disabled:cursor-not-allowed disabled:opacity-45`}
              >
                Next: pick dates
                <Icon name="arrow_forward" className="flex-shrink-0 text-[18px]" />
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      {/* --------------------------------------------------- STEP 2: calendar */}
      {step === "calendar" ? (
        <>
          <Panel
            className="mt-space-lg"
            title={`${shown.length} room${shown.length === 1 ? "" : "s"} · ${caption}`}
            icon="calendar_month"
            caption="Tap any open night to start a booking"
            action={
              <button
                onClick={() => setStep("rooms")}
                className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-2.5 text-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container sm:py-1.5"
              >
                <Icon name="arrow_back" className="text-[15px]" />
                Change rooms
              </button>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {chosen.map((room) => (
                <span
                  key={room.code}
                  className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant"
                >
                  {room.name}
                  <button
                    onClick={() => toggle(room.code)}
                    aria-label={`Remove ${room.name}`}
                    className="text-outline transition-colors hover:text-error"
                  >
                    <Icon name="close" className="text-[14px]" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setStep("rooms")}
                className="rounded-full border border-dashed border-outline-variant/50 px-2.5 py-1 text-label-sm text-label-sm text-outline transition-colors hover:border-primary hover:text-primary"
              >
                + Add room
              </button>
            </div>

            <AvailabilityGrid
              key={`${shown.map((room) => room.code).join("-")}-${seed}`}
              rooms={shown}
              schedule={schedule}
              start={start}
              days={days}
              bookings={bookings}
              onPick={(room, date) => openDetails(room.name, isoDate(date))}
            />
          </Panel>

          <p className="mt-3 flex flex-wrap items-center gap-2 text-label-sm text-label-sm text-outline">
            <Icon name="info" className="text-[15px]" />
            {offset === 0
              ? `This window includes today, ${shortDate(baseToday)}.`
              : `Stepped back ${Math.abs(offset)} window${Math.abs(offset) === 1 ? "" : "s"}.`}
            {offset !== 0 ? (
              <button
                onClick={() => setOffset(0)}
                className="font-semibold text-primary underline underline-offset-2"
              >
                Jump back to today
              </button>
            ) : null}
          </p>
        </>
      ) : null}

      {/* ----------------------------------------------------- STEP 3: details */}
      {step === "details" ? (
        <div className="mt-space-lg grid grid-cols-1 gap-space-md lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title="Who is staying?"
            icon="how_to_reg"
            caption="Everything is saved to this browser — no backend needed"
            action={
              <button
                onClick={() => setStep("calendar")}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-1.5 text-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container"
              >
                <Icon name="arrow_back" className="text-[15px]" />
                Back to calendar
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="bk-room">
                  Room
                </label>
                <select
                  id="bk-room"
                  value={draft.room}
                  onChange={(event) => setDraft({ ...draft, room: event.target.value })}
                  className={fieldClass}
                >
                  {(chosen.length ? chosen : rooms).map((room) => (
                    <option key={room.code} value={room.name}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="bk-name">
                  Guest name
                </label>
                <input
                  id="bk-name"
                  data-autofocus
                  value={draft.guestName}
                  onChange={(event) => setDraft({ ...draft, guestName: event.target.value })}
                  placeholder="e.g. Rahul Nair"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="bk-phone">
                  Guest WhatsApp / Phone
                </label>
                <input
                  id="bk-phone"
                  type="tel"
                  value={draft.guestPhone}
                  onChange={(event) => setDraft({ ...draft, guestPhone: event.target.value })}
                  placeholder="e.g. +91 98300 12345"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="bk-in">
                  Check-in
                </label>
                <input
                  id="bk-in"
                  type="date"
                  value={draft.checkIn}
                  min={isoDate(baseToday)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      checkIn: event.target.value,
                      checkOut:
                        current.checkOut && event.target.value >= current.checkOut
                          ? event.target.value
                          : current.checkOut,
                    }))
                  }
                  className={fieldClass}
                />
                {errors.past ? (
                  <p className="mt-1 text-label-sm text-label-sm text-error">
                    Check-in cannot be in the past.
                  </p>
                ) : null}
              </div>
              <div>
                <label className={labelClass} htmlFor="bk-out">
                  Check-out
                </label>
                <input
                  id="bk-out"
                  type="date"
                  value={draft.checkOut}
                  min={draft.checkIn || isoDate(baseToday)}
                  onChange={(event) => setDraft({ ...draft, checkOut: event.target.value })}
                  className={fieldClass}
                />
                {errors.checkOut ? (
                  <p className="mt-1 text-label-sm text-label-sm text-error">
                    Check-out must be after check-in.
                  </p>
                ) : null}
              </div>
              <div>
                <label className={labelClass} htmlFor="bk-guests">
                  Guests
                </label>
                <input
                  id="bk-guests"
                  type="number"
                  min={1}
                  max={activeRoom?.maxGuests ?? 8}
                  value={draft.guests}
                  onChange={(event) => setDraft({ ...draft, guests: event.target.value })}
                  placeholder="e.g. 2"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="bk-source">
                  Booked via
                </label>
                <select
                  id="bk-source"
                  value={draft.source}
                  onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                  className={`${fieldClass} ${draft.source ? "" : "text-outline"}`}
                >
                  <option value="">Choose a channel</option>
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="bk-notes">
                  Notes
                </label>
                <textarea
                  id="bk-notes"
                  rows={3}
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Airport pickup at 6am, vegetarian breakfast, anniversary trip…"
                  className={`${fieldClass} resize-y`}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Summary" icon="receipt_long" caption="What will be saved">
            <ul className="flex flex-col gap-3 text-label-md text-label-md">
              <li className="flex items-center justify-between gap-3">
                <span className="text-outline">Room</span>
                <span className="text-end font-semibold text-on-surface">{draft.room || "—"}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-outline">Dates</span>
                <span className="text-end font-semibold text-on-surface">
                  {draft.checkIn ? shortDate(new Date(`${draft.checkIn}T00:00:00`)) : "—"} →{" "}
                  {draft.checkOut ? shortDate(new Date(`${draft.checkOut}T00:00:00`)) : "—"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-outline">Nights</span>
                <span className="font-semibold text-on-surface">{nights || "—"}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-outline">Guests</span>
                <span className="font-semibold text-on-surface">
                  {draft.guests ? Number(draft.guests) : "—"}
                </span>
              </li>
              <li className="mt-1 flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-3">
                <span className="font-semibold text-on-surface">Estimated total</span>
                <span className="text-body-md text-body-md font-bold text-primary">
                  {money(estimate)}
                </span>
              </li>
            </ul>

            <button
              onClick={save}
              disabled={!canSave}
              data-testid="save-booking"
              className={`${solidButton} mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <Icon name="save" className="flex-shrink-0 text-[18px]" />
              Save booking
            </button>
            <p className="mt-2 text-center text-label-sm text-label-sm text-outline">
              Saved to this browser and shown in Guest Data.
            </p>
          </Panel>
        </div>
      ) : null}

      <RoomFormDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {/* ------------------------------------------------ SHARE CONFIRMATION MODAL */}
      {shareModal ? (
        <Modal
          open={Boolean(shareModal)}
          onClose={() => setShareModal(null)}
          title="Guest Confirmation & Cab Booking Link"
          description="Send your guest their private homestay portal link to confirm their check-in details and book door-to-door hill cab transfers."
          icon="share"
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <button
                onClick={() => setShareModal(null)}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md font-semibold text-on-surface hover:bg-surface-container"
              >
                Done
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-primary/20 bg-primary-tint/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-on-surface">{shareModal.guestName}</h4>
                  <p className="text-body-sm text-outline">
                    {shareModal.roomName} · {shareModal.checkIn} → {shareModal.checkOut}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-label-xs font-semibold text-primary">
                  {shareModal.booking.channel || "Direct"}
                </span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Dedicated Guest Homestay Link</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareModal.shareUrl}
                  className={`${fieldClass} bg-surface-container text-body-sm text-outline selection:bg-primary-tint`}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareModal.shareUrl);
                    setCopiedShare(true);
                    setTimeout(() => setCopiedShare(false), 2000);
                  }}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-label-sm font-semibold text-on-surface hover:bg-surface-container-highest"
                >
                  <Icon name={copiedShare ? "check" : "content_copy"} className="text-[16px] text-primary" />
                  {copiedShare ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-label-xs text-outline">
                Guests only see their specific homestay details, host contact, and cab options to NJP / Bagdogra.
              </p>
            </div>

            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
              <p className="text-label-xs font-semibold text-outline uppercase tracking-wider">
                WhatsApp Invitation Preview
              </p>
              <p className="mt-1.5 text-body-sm text-on-surface whitespace-pre-line bg-surface-container/50 p-2.5 rounded-lg border border-outline-variant/20 font-sans text-left">
                {`Namaste ${shareModal.guestName}! 🌸\n\nYour stay at ${shareModal.roomName} (${shareModal.checkIn} to ${shareModal.checkOut}) is confirmed.\n\nView your personalized homestay portal and reserve your direct hill cab transfer (NJP Railway Station / Bagdogra Airport IXB) here:\n${shareModal.shareUrl}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const cleanPhone = shareModal.guestPhone.replace(/\D/g, "");
                const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                const msg = `Namaste ${shareModal.guestName}! 🌸\n\nYour stay at ${shareModal.roomName} (${shareModal.checkIn} to ${shareModal.checkOut}) is confirmed.\n\nView your personalized homestay portal and reserve your direct hill cab transfer (NJP Railway Station / Bagdogra Airport IXB) here:\n${shareModal.shareUrl}`;
                const waUrl = phoneWithCountry
                  ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`
                  : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                window.open(waUrl, "_blank");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white shadow-xs hover:bg-[#1EBE5D] transition-colors"
            >
              <Icon name="chat" className="text-[18px]" />
              Send to Guest on WhatsApp
            </button>
          </div>
        </Modal>
      ) : null}

      {/* ------------------------------------------------ OTA CALENDAR SYNC MODAL */}
      {icalModalOpen ? (
        <Modal
          open={icalModalOpen}
          onClose={() => {
            setIcalModalOpen(false);
            setSyncResult(null);
          }}
          title="OTA Calendar Synchronization (Airbnb / iCal)"
          description="Sync room availability two-way with Airbnb, MakeMyTrip, and external OTAs via standard iCal (.ics) feeds."
          icon="sync"
          size="lg"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIcalModalOpen(false);
                  setSyncResult(null);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md font-semibold text-on-surface hover:bg-surface-container"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-5">
            <div>
              <label className={labelClass}>Select Room Unit</label>
              <select
                value={syncRoomCode || (rooms[0]?.code ?? "")}
                onChange={(e) => {
                  setSyncRoomCode(e.target.value);
                  setSyncResult(null);
                }}
                className={fieldClass}
              >
                {rooms.map((room) => (
                  <option key={room.code} value={room.code}>
                    {room.name} ({room.code}) - {room.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Outbound Sync Card */}
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                  <Icon name="upload" className="text-[18px]" />
                </span>
                <div className="flex-1">
                  <h4 className="text-body-md font-semibold text-on-surface">
                    1. Export to Airbnb / OTAs (Outbound Feed)
                  </h4>
                  <p className="mt-0.5 text-label-sm text-outline">
                    Copy this iCal URL and paste it into Airbnb Listing Settings ➔ Pricing & Availability ➔ Calendar Sync ➔ Import Calendar.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={API_ENDPOINTS.ical.exportFeed(syncRoomCode || rooms[0]?.code || "101")}
                      className={`${fieldClass} bg-surface-container text-body-sm text-outline selection:bg-primary-tint`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = API_ENDPOINTS.ical.exportFeed(syncRoomCode || rooms[0]?.code || "101");
                        navigator.clipboard.writeText(url);
                        setCopiedIcalFeed(true);
                        setTimeout(() => setCopiedIcalFeed(false), 2000);
                      }}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-label-sm font-semibold text-on-surface hover:bg-surface-container-highest"
                    >
                      <Icon name={copiedIcalFeed ? "check" : "content_copy"} className="text-[16px] text-primary" />
                      {copiedIcalFeed ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Inbound Sync Card */}
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-secondary-tint text-secondary-ink">
                  <Icon name="download" className="text-[18px]" />
                </span>
                <div className="flex-1">
                  <h4 className="text-body-md font-semibold text-on-surface">
                    2. Import from Airbnb (Inbound Sync)
                  </h4>
                  <p className="mt-0.5 text-label-sm text-outline">
                    Paste your Airbnb Calendar Export URL (.ics) to block occupied dates and import reservations.
                  </p>
                  <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
                    <input
                      type="url"
                      placeholder="https://www.airbnb.com/calendar/ical/12345678.ics?s=..."
                      value={inboundIcalUrl}
                      onChange={(e) => setInboundIcalUrl(e.target.value)}
                      className={`${fieldClass} flex-1`}
                    />
                    <button
                      type="button"
                      disabled={syncingIcal || !inboundIcalUrl.trim()}
                      onClick={async () => {
                        try {
                          setSyncingIcal(true);
                          setSyncResult(null);
                          const targetCode = syncRoomCode || rooms[0]?.code || "101";
                          const res = await fetch(API_ENDPOINTS.ical.syncInbound(targetCode), {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ icalUrl: inboundIcalUrl.trim() }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setSyncResult(data.message || `Successfully synced ${data.data?.syncedCount ?? 0} dates.`);
                            notify(data.message || "Calendar synchronized successfully!", {
                              icon: "sync",
                              tone: "success",
                            });
                          } else {
                            setSyncResult(`Sync failed: ${data.error || "Unknown error"}`);
                            notify(data.error || "Sync failed", { tone: "warning" });
                          }
                        } catch (err: any) {
                          setSyncResult(`Network error: ${err.message}`);
                          notify("Network error synchronizing calendar", { tone: "warning" });
                        } finally {
                          setSyncingIcal(false);
                        }
                      }}
                      className={`${solidButton} justify-center disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <Icon name={syncingIcal ? "hourglass_top" : "sync"} className="text-[18px]" />
                      {syncingIcal ? "Syncing…" : "Sync Now"}
                    </button>
                  </div>
                  {syncResult ? (
                    <p className={`mt-2 text-label-sm font-semibold ${syncResult.includes("failed") || syncResult.includes("error") ? "text-error" : "text-primary"}`}>
                      {syncResult}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

function baseTodayIso() {
  return isoDate(baseToday);
}
