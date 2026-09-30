"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FieldError } from "@/components/field-error";
import { Icon } from "@/components/icon";
import { LocationPicker } from "@/components/cab/location-picker";
import {
  CAB_SEAT_TYPES,
  ESTATE,
  driversHref,
  requestFromLabels,
  validateCabRequest,
  type CabRequest,
  type CabPoint,
  type SeatTypeId,
} from "@/lib/cabs";
import { today } from "@/lib/booking";

const field =
  "mt-1.5 min-h-11 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-2.5 text-body-md text-on-surface transition-colors placeholder:text-outline focus:border-primary focus:outline-none";

const label = "text-body-sm font-medium text-on-surface";

const submitClass =
  "group flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-primary-container px-6 text-title-md font-semibold text-on-primary shadow-lg shadow-primary-container/20 transition-all duration-200 hover:bg-primary hover:shadow-xl active:scale-[0.99]";

export function CabForm({ initial }: { initial: CabRequest | null }) {
  const router = useRouter();
  const [request, setRequest] = useState<CabRequest>(
    initial ??
      requestFromLabels(
        ESTATE.name,
        "",
        today(),
        "15:00",
        "4",
      ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends "date" | "time" | "seats">(key: K, value: CabRequest[K]) {
    setRequest((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;

      const next = { ...current };
      delete next[key as string];

      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validateCabRequest(request);
    setErrors(found);

    if (Object.keys(found).length) {
      document.getElementById(`cab-${Object.keys(found)[0]}`)?.focus();

      return;
    }

    router.push(driversHref(request));
  }

  return (
    <form
      id="cab-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/40 p-4"
        >
          <Icon name="error" className="shrink-0 text-lg text-error" />
          <p className="text-body-sm text-on-surface">
            Please check the highlighted fields before we search for drivers.
          </p>
        </div>
      )}

      <div>
        <span className={label}>
          <Icon name="route" className="mr-1 align-[-3px] text-base text-primary" />
          Pickup &amp; Drop
        </span>
        <div className="mt-1.5">
          <LocationPicker
            from={request.source}
            to={request.destination}
            errors={errors}
            onChange={({ from, to }: { from: CabPoint; to: CabPoint }) => {
              setRequest((current) => ({ ...current, source: from, destination: to }));
              setErrors((current) => {
                const next = { ...current };
                delete next.source;
                delete next.destination;
                return next;
              });
            }}
          />
        </div>
        <FieldError id="cab-source-error" message={errors.source} />
        <FieldError id="cab-destination-error" message={errors.destination} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cab-date" className={label}>
            <Icon name="calendar_month" className="mr-1 align-[-3px] text-base text-primary" />
            Pickup Date
          </label>
          <input
            id="cab-date"
            name="date"
            type="date"
            min={today()}
            value={request.date}
            onChange={(event) => update("date", event.target.value)}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? "cab-date-error" : undefined}
            className={field}
          />
          <FieldError id="cab-date-error" message={errors.date} />
        </div>

        <div>
          <label htmlFor="cab-time" className={label}>
            <Icon name="schedule" className="mr-1 align-[-3px] text-base text-primary" />
            Pickup Time
          </label>
          <input
            id="cab-time"
            name="time"
            type="time"
            value={request.time}
            onChange={(event) => update("time", event.target.value)}
            aria-invalid={Boolean(errors.time)}
            aria-describedby={errors.time ? "cab-time-error" : undefined}
            className={field}
          />
          <FieldError id="cab-time-error" message={errors.time} />
        </div>
      </div>

      <fieldset id="cab-seats" tabIndex={-1} className="focus:outline-none">
        <legend className={label}>
          <Icon name="airline_seat_recline_normal" className="mr-1 align-[-3px] text-base text-primary" />
          Seat Capacity
        </legend>
        <div className="mt-2.5 grid gap-3 xs:grid-cols-3">
          {CAB_SEAT_TYPES.map((seat) => {
            const active = request.seats === seat.id;

            return (
              <label
                key={seat.id}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors duration-200 ${
                  active
                    ? "border-primary bg-primary-fixed/40"
                    : "border-outline-variant/50 bg-surface-container-lowest hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="seats"
                  value={seat.id}
                  checked={active}
                  onChange={() => update("seats", seat.id as SeatTypeId)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-title-md font-semibold leading-tight text-primary">
                    {seat.label}
                  </span>
                  <span className="block text-label-sm text-on-surface-variant">
                    {seat.detail}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <FieldError message={errors.seats} />
      </fieldset>

      <div className="hidden lg:block">
        <button type="submit" className={submitClass}>
          <span>Find Drivers Nearby</span>
          <Icon
            name="search"
            className="text-base transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
      <p className="text-label-sm leading-relaxed text-outline">
        Estate &amp; hill-road rates • Cash and UPI on arrival • Free cancellation up to 12 hours
        before pickup
      </p>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <button type="submit" form="cab-form" className={submitClass}>
          <span>Find Drivers Nearby</span>
          <Icon
            name="search"
            className="text-base transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </form>
  );
}
