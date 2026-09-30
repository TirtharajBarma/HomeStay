"use server";

import { arrivalWindows, breakfastChoices } from "@/lib/content";
import { validateCard } from "@/lib/payment";
import { getStay } from "@/lib/stays";
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

function reference(): { reference: string; pin: string } {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return {
    reference: `MF-${(values[0] % 1_000_000).toString().padStart(6, "0")}`,
    pin: String((values[1] % 9000) + 1000),
  };
}

export async function confirmReservation(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const stay = getStay(text(formData, "stay"));
  if (!stay) {
    return {
      status: "error",
      message: "That sanctuary is no longer available for these dates.",
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
  const ids = reference();

  return {
    status: "confirmed",
    reservation: {
      reference: ids.reference,
      pin: ids.pin,
      stayName: stay.name,
      staySlug: stay.slug,
      guestName: `${firstName} ${lastName}`,
      email,
      phone,
      arrivalWindow: arrival?.label ?? arrivalWindows[0].label,
      breakfasts,
      dates: formatDateRange(booking),
      nights: booking.nights,
      guests: formatGuests(booking.guests),
      plan,
      settled: quote.total - dueToday <= 0,
      dueToday: formatMoney(dueToday),
      balance: formatMoney(quote.total - dueToday),
      total: formatMoney(quote.total),
      cancellationBy: cancellationDeadline(booking.checkIn),
    },
  };
}
