"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { reservationKey, useCalendar } from "./calendar-provider";
import { addDays, WINDOW_DAYS } from "@/lib/calendar-window";
import { selectedReservation as designedStay } from "@/lib/calendar-data";
import type { Reservation } from "@/lib/calendar-data";

const NIGHTLY = 195;

const channelCopy: Record<
  Reservation["channel"],
  { badge: string; source: string; status: string }
> = {
  direct: { badge: "Direct Booking", source: "Booked via Direct Guest Portal", status: "Confirmed • In House" },
  airbnb: { badge: "Airbnb Synced", source: "Synced from Airbnb (iCal feed)", status: "Confirmed • Synced" },
  ota: { badge: "Booking.com", source: "Synced from Booking.com", status: "Confirmed • Synced" },
  blocked: { badge: "Maintenance Hold", source: "Blocked by estate operations", status: "Blocked • Not bookable" },
};

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Deterministic contact details so any bar resolves to a full folio. */
function hashOf(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildStay(
  guest: string,
  roomLabel: string,
  bed: string,
  checkIn: string,
  checkOut: string,
  nights: number,
  channel: Reservation["channel"],
  key: string,
) {
  const seed = hashOf(key);
  const subtotal = NIGHTLY * nights;
  const cleaning = 40;
  const tax = Math.round((subtotal + cleaning) * 0.04);
  const handle = guest.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/)[0];
  const domain = ["mailbox.test", "vermontcraft.net", "northtrail.co"][seed % 3];

  return {
    ...designedStay,
    guest,
    reservationId: `#MF-2024-${8000 + (seed % 999)}`,
    source: channelCopy[channel].source,
    room: roomLabel,
    bed,
    checkIn,
    checkOut,
    duration: `${nights} Night${nights === 1 ? "" : "s"}`,
    phone: `+1 (555) ${String(200 + (seed % 700)).padStart(3, "0")}-${String(1000 + (seed % 8999))}`,
    email: `${handle}@${domain}`,
    keycode: `#${1000 + (seed % 8999)}*`,
    charges: [
      { label: `Nightly Rate ($${NIGHTLY} × ${nights})`, value: money(subtotal) },
      { label: "Estate Cleaning Fee", value: money(cleaning) },
      { label: "Lodging Tax (4%)", value: money(tax) },
    ],
    total: money(subtotal + cleaning + tax),
  };
}

function Field({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} className="mt-0.5 text-[18px] text-primary-container" />
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-label-sm text-label-sm text-outline uppercase">
      {children}
    </span>
  );
}

function InspectorColumn({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="text-[18px] text-secondary" />
        <h4 className="text-label-md text-label-md font-bold text-on-surface uppercase">
          {title}
        </h4>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function ReservationInspector() {
  const { selected, start, clearSelection, amend, selectedKey } = useCalendar();
  const { notify } = useToast();
  const [message, setMessage] = useState(false);
  const [modify, setModify] = useState(false);
  const [draft, setDraft] = useState({ start: 0, nights: 1 });

  const stay = useMemo(() => {
    if (!selected) return designedStay;
    const { reservation, room } = selected;
    const checkIn = addDays(start, reservation.start);
    const checkOut = addDays(start, reservation.start + reservation.nights);
    const fmt = (date: Date) =>
      date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    return {
      ...buildStay(
        reservation.guest,
        `${room.code} - ${room.name}`,
        room.note,
        `${fmt(checkIn)} (3:00 PM)`,
        `${fmt(checkOut)} (11:00 AM)`,
        reservation.nights,
        reservation.channel,
        reservationKey(room, reservation),
      ),
      channel: reservation.channel,
    };
  }, [selected, start]);

  const channel = selected?.reservation.channel ?? "direct";
  const copy = channelCopy[channel];

  const openModify = () => {
    if (!selected) return;
    setDraft({
      start: selected.reservation.start,
      nights: selected.reservation.nights,
    });
    setModify(true);
  };

  const saveModify = () => {
    if (!selected) return;
    const nights = Math.max(1, Math.min(draft.nights, WINDOW_DAYS - draft.start));
    amend(reservationKey(selected.room, selected.reservation), {
      start: draft.start,
      nights,
    });
    setModify(false);
    notify(`${stay.guest}'s stay moved to ${addDays(start, draft.start).toLocaleString("en-US", { month: "short", day: "numeric" })} for ${nights} night${nights === 1 ? "" : "s"}.`, {
      icon: "event_available",
      tone: "success",
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_1px_3px_rgba(45,48,46,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/30 bg-primary/4 px-4 py-4 md:px-space-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon name="person" className="text-[22px]" />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-headline-sm text-headline-sm font-semibold text-on-surface">
                {stay.guest}
              </h3>
              <span className="rounded-full bg-primary-tint px-2 py-0.5 text-label-sm text-label-sm font-semibold text-on-primary-container">
                {copy.badge}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-hold-surface px-2 py-0.5 text-label-sm text-label-sm font-semibold text-hold-ink">
                <Icon
                  name={channel === "blocked" ? "build" : "check_circle"}
                  className="text-[13px]"
                />
                {copy.status}
              </span>
            </div>
            <span className="text-label-sm text-label-sm text-outline">
              {stay.source}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-surface-container px-2.5 py-1 text-label-md text-label-md text-on-surface-variant">
            {stay.reservationId}
          </span>
          {selected ? (
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-1.5 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="close" className="text-[16px]" />
              <span>Clear selection</span>
            </button>
          ) : null}
          <button
            onClick={() => {
              window.print();
              notify("Folio sent to the print dialog.", { icon: "print" });
            }}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-1.5 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="print" className="text-[16px]" />
            <span>Print Folio</span>
          </button>
          <button
            onClick={() => setMessage(true)}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-1.5 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="chat" className="text-[16px]" />
            <span>Send Message</span>
          </button>
          <button
            onClick={openModify}
            disabled={!selectedKey}
            title={selectedKey ? undefined : "Select a reservation bar to edit it"}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:opacity-45"
          >
            <Icon name="edit_calendar" className="text-[16px]" />
            <span>Modify Reservation</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-4 sm:grid-cols-2 md:p-space-md lg:grid-cols-4">
        <InspectorColumn title="Stay Details" icon="event_available">
          <Field icon="meeting_room">
            <Label>Room</Label>
            <span className="text-title-md text-title-md font-semibold text-on-surface">
              {stay.room}
            </span>
            <span className="text-body-sm text-body-sm text-on-surface-variant">
              {stay.bed}
            </span>
          </Field>
          <Field icon="login">
            <Label>Check-in</Label>
            <span className="text-body-md text-body-md text-on-surface">
              {stay.checkIn}
            </span>
          </Field>
          <Field icon="logout">
            <Label>Check-out</Label>
            <span className="text-body-md text-body-md text-on-surface">
              {stay.checkOut}
            </span>
          </Field>
          <div className="flex items-center gap-2 rounded-md bg-surface-container px-2.5 py-1.5 text-body-sm text-body-sm text-on-surface-variant">
            <Icon name="nights_stay" className="text-[16px] text-tertiary" />
            {stay.duration}
          </div>
        </InspectorColumn>

        <InspectorColumn title="Guest Contact" icon="contact_phone">
          <Field icon="call">
            <Label>Phone</Label>
            <span className="text-body-md text-body-md text-on-surface">
              {stay.phone}
            </span>
          </Field>
          <Field icon="mail">
            <Label>Email</Label>
            <span className="text-body-md text-body-md text-on-surface">
              {stay.email}
            </span>
          </Field>
          <Field icon="vpn_key">
            <Label>Door Keycode</Label>
            <span className="text-body-md text-body-md font-semibold text-on-surface">
              {stay.keycode}
            </span>
            <span className="flex items-center gap-1 text-label-sm text-label-sm text-on-primary-container">
              <Icon name="check_circle" className="text-[13px]" />
              Active on Door
            </span>
          </Field>
        </InspectorColumn>

        <InspectorColumn title="Special Requests" icon="note_alt">
          {stay.notes.map((note) => (
            <div
              key={note.title}
              className="flex items-start gap-2.5 rounded-md bg-surface-container p-2.5"
            >
              <Icon
                name={note.icon}
                className={`mt-0.5 text-[16px] ${note.tone}`}
              />
              <p className="text-body-sm text-body-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">
                  {note.title}
                </span>{" "}
                {note.body}
              </p>
            </div>
          ))}
        </InspectorColumn>

        <InspectorColumn title="Payment Summary" icon="payments">
          <div className="flex flex-col gap-1.5">
            {stay.charges.map((charge) => (
              <div
                key={charge.label}
                className="flex items-center justify-between text-body-sm text-body-sm text-on-surface-variant"
              >
                <span>{charge.label}</span>
                <span className="font-medium text-on-surface">
                  {charge.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-outline-variant/40 pt-2">
            <span className="text-label-md text-label-md font-semibold text-on-surface">
              Total Paid
            </span>
            <span className="text-headline-sm text-headline-sm font-bold text-primary">
              {stay.total}
            </span>
          </div>
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-label-sm text-label-sm font-semibold text-on-primary-container">
            <Icon name="verified" className="text-[14px]" />
            Paid in Full
          </span>
        </InspectorColumn>
      </div>

      <Modal
        open={message}
        onClose={() => setMessage(false)}
        title={`Message ${stay.guest}`}
        description={`Delivered to ${stay.email} · ${stay.room}`}
        icon="chat"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setMessage(false)}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setMessage(false);
                notify(`Message queued for ${stay.guest}.`, {
                  icon: "mark_email_read",
                  tone: "success",
                });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Send message
            </button>
          </>
        }
      >
        <MessageForm guest={stay.guest} />
      </Modal>

      <Modal
        open={modify}
        onClose={() => setModify(false)}
        title="Modify reservation"
        description={stay.guest}
        icon="edit_calendar"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setModify(false)}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={saveModify}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Save changes
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
              htmlFor="mod-start"
            >
              Arrival day
            </label>
            <select
              id="mod-start"
              value={draft.start}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDraft((current) => ({
                  start: next,
                  nights: Math.min(current.nights, WINDOW_DAYS - next),
                }));
              }}
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            >
              {Array.from({ length: WINDOW_DAYS }, (_, index) => (
                <option key={index} value={index}>
                  Day {index + 1} ·{" "}
                  {addDays(start, index).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
              htmlFor="mod-nights"
            >
              Nights
            </label>
            <input
              id="mod-nights"
              type="number"
              min={1}
              max={WINDOW_DAYS - draft.start}
              value={draft.nights}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  nights: Math.max(
                    1,
                    Math.min(Number(event.target.value) || 1, WINDOW_DAYS - current.start),
                  ),
                }))
              }
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            />
          </div>
        </div>
      </Modal>
    </section>
  );
}

function MessageForm({ guest }: { guest: string }) {
  const [text, setText] = useState(
    `Hi ${guest.split(" ")[0]}, a quick note from the Meadowfall team — `,
  );
  return (
    <div className="space-y-3">
      <label className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant">
        Template
      </label>
      <div className="flex flex-wrap gap-2">
        {["Arrival details", "Delay to departure", "Maintenance update"].map(
          (label) => (
            <button
              key={label}
              onClick={() =>
                setText(
                  (current) => `${current}

${label}: `,
                )
              }
              className="rounded-full border border-outline-variant/40 px-3 py-1 text-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              {label}
            </button>
          ),
        )}
      </div>
      <label
        className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
        htmlFor="guest-message"
      >
        Message
      </label>
      <textarea
        id="guest-message"
        data-autofocus
        rows={5}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
      />
    </div>
  );
}
