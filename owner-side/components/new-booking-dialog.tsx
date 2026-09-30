"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { roomNames } from "@/lib/rooms-data";

export type NewBookingDraft = {
  guest: string;
  room: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: "Direct" | "Airbnb" | "Booking.com";
  notes: string;
};

const emptyDraft: NewBookingDraft = {
  guest: "",
  room: roomNames[0],
  checkIn: "",
  checkOut: "",
  guests: 2,
  source: "Direct",
  notes: "",
};

type NewBookingDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Pre-selects a unit, e.g. when opened from a room card. */
  defaultRoom?: string;
  title?: string;
  description?: string;
  /** Unit list; the calendar passes its own rooms so walk-ins target the right one. */
  rooms?: string[];
  onCreated?: (draft: NewBookingDraft) => void;
};

export function NewBookingDialog({
  open,
  onClose,
  defaultRoom,
  title = "New Booking",
  description = "Creates a direct reservation and syncs it to connected channels.",
  rooms,
  onCreated,
}: NewBookingDialogProps) {
  const units = rooms?.length ? rooms : roomNames;
  const fallbackRoom = defaultRoom && units.includes(defaultRoom) ? defaultRoom : units[0];
  const [draft, setDraft] = useState<NewBookingDraft>({
    ...emptyDraft,
    room: fallbackRoom,
  });
  const [touched, setTouched] = useState(false);
  const { notify } = useToast();

  const set = <K extends keyof NewBookingDraft>(key: K, value: NewBookingDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const guestError = draft.guest.trim().length < 2;
  const datesError = !draft.checkIn || !draft.checkOut || draft.checkOut <= draft.checkIn;

  const reset = () => {
    setDraft({ ...emptyDraft, room: fallbackRoom });
    setTouched(false);
  };

  const submit = () => {
    setTouched(true);
    if (guestError || datesError) {
      notify("Complete the guest name and stay dates first.", { tone: "warning" });
      return;
    }
    notify(`Reservation confirmed for ${draft.guest.trim()} · ${draft.room}`, {
      icon: "check_circle",
      tone: "success",
    });
    onCreated?.(draft);
    reset();
    onClose();
  };

  const nights =
    draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn
      ? Math.round(
          (new Date(draft.checkOut).getTime() - new Date(draft.checkIn).getTime()) /
            86_400_000,
        )
      : 0;

  const field =
    "w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
  const label = "mb-1 block text-label-md text-label-md font-medium text-on-surface-variant";

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={title}
      description={description}
      icon="event_available"
      footer={
        <>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container active:scale-[0.98]"
          >
            <span className="ms-outlined text-[18px]">check</span>
            Confirm reservation
          </button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="sm:col-span-2">
          <label className={label} htmlFor="nb-guest">
            Guest name
          </label>
          <input
            id="nb-guest"
            data-autofocus
            value={draft.guest}
            onChange={(event) => set("guest", event.target.value)}
            placeholder="e.g. Helena Rask"
            aria-invalid={touched && guestError}
            className={`${field} ${
              touched && guestError ? "border-error" : "border-outline-variant/40"
            }`}
          />
          {touched && guestError ? (
            <p className="mt-1 text-label-sm text-label-sm text-error">
              Enter the guest&apos;s name.
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="nb-room">
            Unit
          </label>
          <select
            id="nb-room"
            value={draft.room}
            onChange={(event) => set("room", event.target.value)}
            className={`${field} border-outline-variant/40`}
          >
            {units.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="nb-in">
            Check-in
          </label>
          <input
            id="nb-in"
            type="date"
            value={draft.checkIn}
            onChange={(event) => set("checkIn", event.target.value)}
            className={`${field} border-outline-variant/40`}
          />
        </div>

        <div>
          <label className={label} htmlFor="nb-out">
            Check-out
          </label>
          <input
            id="nb-out"
            type="date"
            value={draft.checkOut}
            min={draft.checkIn || undefined}
            onChange={(event) => set("checkOut", event.target.value)}
            aria-invalid={touched && datesError}
            className={`${field} ${
              touched && datesError ? "border-error" : "border-outline-variant/40"
            }`}
          />
        </div>

        <div>
          <label className={label} htmlFor="nb-guests">
            Guests
          </label>
          <input
            id="nb-guests"
            type="number"
            min={1}
            max={12}
            value={draft.guests}
            onChange={(event) =>
              set("guests", Math.max(1, Number(event.target.value) || 1))
            }
            className={`${field} border-outline-variant/40`}
          />
        </div>

        <div>
          <label className={label} htmlFor="nb-source">
            Source
          </label>
          <select
            id="nb-source"
            value={draft.source}
            onChange={(event) =>
              set("source", event.target.value as NewBookingDraft["source"])
            }
            className={`${field} border-outline-variant/40`}
          >
            <option>Direct</option>
            <option>Airbnb</option>
            <option>Booking.com</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="nb-notes">
            Guest notes
          </label>
          <textarea
            id="nb-notes"
            rows={3}
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
            placeholder="Arrival time, dietary notes, occasion…"
            className={`${field} resize-y border-outline-variant/40`}
          />
        </div>

        <p className="sm:col-span-2 text-label-sm text-label-sm text-outline">
          {nights > 0
            ? `${nights} night${nights === 1 ? "" : "s"} · ${draft.guests} guest${
                draft.guests === 1 ? "" : "s"
              } · ${draft.source}`
            : "Select a check-in and check-out date to see the stay length."}
        </p>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
