"use server";

import { API_ENDPOINTS } from "@/lib/api-config";
import { arrivalWindows, breakfastChoices } from "@/lib/content";
import { validateCard } from "@/lib/payment";
import { getLiveStay } from "@/lib/stays";
import {
  cancellationDeadline,
  formatDateRange,
  formatGuests,
  formatMoney,
  quoteFor,
  resolveBooking,
  type RawParams,
} from "@/lib/booking";

export type Reservation = {
  reference: string;
  pin: string;
  stayName: string;
  staySlug: string;
  guestName: string;
  email: string;
  phone: string;
  arrivalWindow: string;
  breakfasts: string[];
  dates: string;
  nights: number;
  guests: string;
  plan: "card_full" | "deposit";
  settled: boolean;
  dueToday: string;
  balance: string;
  total: string;
  cancellationBy: string;
};

export type CheckoutState =
  | { status: "idle" }
  | { status: "error"; message: string; errors: Record<string, string> }
  | { status: "confirmed"; reservation: Reservation };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bookingParams(formData: FormData): RawParams {
  return {
    checkIn: text(formData, "checkIn"),
    checkOut: text(formData, "checkOut"),
    guests: text(formData, "guests"),
  };
}

export async function confirmReservation(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const stay = await getLiveStay(text(formData, "stay"));
  if (!stay) {
    return {
      status: "error",
      message: "We couldn't load that stay right now, or it is no longer available. Nothing was booked.",
      errors: { stay: "Choose a stay from the accommodations page to continue." },
    };
  }

  const booking = resolveBooking(bookingParams(formData), stay.maxGuests);
  const quote = quoteFor(stay.price, booking);

  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const email = text(formData, "email");
  const phone = text(formData, "phone");

  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "Required for your door PIN.";
  if (!lastName) errors.lastName = "Required for your reservation voucher.";
  if (!EMAIL.test(email)) errors.email = "Enter a valid email so we can send your directions.";
  if (phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a reachable phone number.";
  if (formData.get("terms") !== "on") {
    errors.terms = "Please accept the house rules and guest terms to continue.";
  }

  Object.assign(
    errors,
    validateCard({
      cardName: text(formData, "cardName"),
      cardNumber: text(formData, "cardNumber"),
      expiry: text(formData, "expiry"),
      cvc: text(formData, "cvc"),
    }),
  );

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "A few details still need your attention before we can confirm the stay.",
      errors,
    };
  }

  const plan = formData.get("paymentPlan") === "deposit" ? "deposit" : "card_full";
  const dueToday = plan === "deposit" ? quote.deposit : quote.total;
  const arrival = arrivalWindows.find((window) => window.value === text(formData, "arrivalWindow"));
  const breakfasts = formData
    .getAll("breakfast")
    .filter((value): value is string => typeof value === "string")
    .map((value) => breakfastChoices.find((choice) => choice.value === value)?.label)
    .filter((label): label is string => Boolean(label));

  try {
    const res = await fetch(API_ENDPOINTS.reservations.create(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stay: stay.slug,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
        firstName,
        lastName,
        email,
        phone,
        arrivalWindow: arrival?.label ?? arrivalWindows[0].label,
        breakfasts,
        paymentPlan: plan,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = body?.error;
      return {
        status: "error",
        message:
          (typeof err === "string" ? err : err?.message) ||
          body?.message ||
          "Reservation could not be completed. The room may already be booked for these dates. Nothing was charged.",
        errors: {},
      };
    }

    const result = await res.json();
    const b = result?.data;
    // Only a server-issued reference, PIN and amounts count as a confirmed booking.
    const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    if (
      result?.success &&
      b?.reference &&
      b?.pin &&
      isNum(b.dueToday) &&
      isNum(b.balanceDue) &&
      isNum(b.totalAmount)
    ) {
      return {
        status: "confirmed",
        reservation: {
          reference: b.reference,
          pin: b.pin,
          stayName: b.roomName || stay.name,
          staySlug: b.staySlug || stay.slug,
          guestName: b.guestName,
          email: b.email,
          phone: b.phone,
          arrivalWindow: b.arrivalWindow || arrival?.label || "",
          breakfasts: b.breakfasts || [],
          dates: formatDateRange(booking),
          nights: b.nights || booking.nights,
          guests: formatGuests(b.party || booking.guests),
          plan: b.plan,
          settled: b.settled,
          dueToday: formatMoney(b.dueToday),
          balance: formatMoney(b.balanceDue),
          total: formatMoney(b.totalAmount),
          cancellationBy: b.cancellationBy || cancellationDeadline(booking.checkIn),
        },
      };
    }

    return {
      status: "error",
      message:
        "The reservation server did not return a confirmation, so this booking is NOT confirmed. Please contact the homestay before trying again.",
      errors: {},
    };
  } catch (apiErr: any) {
    return {
      status: "error",
      message: `Unable to reach the reservation server (${apiErr?.message || "network error"}). Your booking is NOT confirmed.`,
      errors: {},
    };
  }
}
