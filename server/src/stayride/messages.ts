// Wording of every WhatsApp message StayRide sends from the company number.
// Each builder returns the template variables ({{1}}, {{2}}... in order) and the same message as plain
// text. Keep the two in step: the approved Meta template body must use these variables in this order.
//
// Privacy rule from the cab flow: the guest never gets the driver's phone, and the driver never gets
// the guest's phone, until the advance is paid (ADVANCE_PAID_* messages only).
import type { WhatsAppMessage } from '../services/whatsapp.service.js';
import { config } from '../config/env.js';

type Built = Omit<WhatsAppMessage, 'to'>;

/** Log / webhook context of a message about a trip (see WhatsAppContext). */
const ctxOf = (doc: any) => ({
  ref: doc.reference || undefined,
  tenantId: doc.propertyId ? String(doc.propertyId) : undefined,
  driverId: doc.assignedDriverUserId ? String(doc.assignedDriverUserId) : doc.ownFleet && doc.ownDriverId != null ? `own-${doc.ownDriverId}` : undefined,
});

const rupees = (n: unknown) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const whenText = (doc: any) =>
  `${new Date(doc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} at ${doc.time}`;
const routeText = (doc: any) => {
  const stops = (doc.destinations || []).map((d: any) => d.address).filter(Boolean);
  const base = [doc.pickupLocation?.address, ...stops].filter(Boolean).join(' → ') || 'Local trip';
  if (doc.isRoundTrip) {
    const pickupAddr = doc.pickupLocation?.address || 'Pickup';
    return `${base} ➔ [Return to ${pickupAddr}] (ROUND TRIP)`;
  }
  return base;
};
const vehicleText = (doc: any) => {
  const model = doc.vehicleDetails?.model || '';
  const plate = doc.vehicleDetails?.plate || '';
  if (model && plate && model.includes(plate)) {
    return model;
  }
  return [model, plate].filter(Boolean).join(' ') || doc.vehicleType || 'Cab';
};

export const askCabMessage = (guestName: string, homestayName: string, link: string): Built => ({
  event: 'ASK_CAB',
  params: [guestName, homestayName, link],
  text:
    `Namaste ${guestName}.\n` +
    `If you need an airport transfer, sightseeing, or a local hill cab during your stay at ${homestayName}, please share your itinerary and we will arrange a verified driver for you:\n${link}`,
});

export const preArrivalTransferMessage = (guestName: string, homestayName: string, link: string, checkInDateText: string): Built => ({
  event: 'ASK_CAB',
  params: [guestName, homestayName, link],
  text:
    `Namaste ${guestName}!\n` +
    `We look forward to welcoming you to ${homestayName} on ${checkInDateText}.\n` +
    `If you need an airport transfer from Bagdogra (IXB) or railway pickup from NJP to reach us safely, reserve a verified mountain cab here:\n${link}`,
});

export const welcomeSightseeingMessage = (guestName: string, homestayName: string, link: string): Built => ({
  event: 'ASK_CAB',
  params: [guestName, homestayName, link],
  text:
    `Namaste ${guestName}, welcome to ${homestayName}!\n` +
    `Planning your Tiger Hill sunrise, tea garden tour, or a local hill excursion during your stay? Arrange your trusted local cab here:\n${link}`,
});

/** quoteLink: the driver's own page to quote without opening the app (WhatsApp-only drivers). */
export const newRequestMessage = (doc: any, quoteLink: string): Built => {
  const budgetInfo = doc.guestBudget ? `\nGuest Target Budget: ₹${Number(doc.guestBudget).toLocaleString('en-IN')}` : '';
  const roundTripInfo = doc.isRoundTrip
    ? `\nTrip Type: Round Trip (Driver waits during tour & returns guest)${doc.returnTime ? `\nReturn: ${doc.returnDate ? new Date(Number(doc.returnDate)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : 'Same Day'} at ${doc.returnTime}` : ''}`
    : '\nTrip Type: One-Way Drop';
  const params = [doc.homestayName || 'a homestay', routeText(doc), whenText(doc), doc.vehicleType || 'Cab', quoteLink];
  return {
    event: 'NEW_REQUEST',
    context: ctxOf(doc),
    params,
    text:
      `New trip request from ${params[0]}.\n` +
      `Route: ${params[1]}\n` +
      `Pickup: ${params[2]}\n` +
      `Vehicle: ${params[3]}${roundTripInfo}${budgetInfo}\n\n` +
      `Submit your total trip fare quote here: ${params[4]}\n\n` +
      `Guest pays 15% advance online; you collect the rest in cash at drop-off.`,
  };
};

export const quoteCounterMessage = (driverName: string, reference: string, counterFare: number, quoteLink: string): Built => {
  const params = [driverName, reference, rupees(counterFare), quoteLink];
  return {
    event: 'QUOTE_COUNTER',
    context: { ref: reference },
    params,
    text: `Hello ${params[0]}, the homestay has made a counter-offer of ${params[2]} for trip ${params[1]}. You can accept this offer or keep your original fare here:\n${params[3]}`,
  };
};

/** The guest did not pay the advance in time; the held driver was released. */
export const advanceExpiredGuestMessage = (doc: any): Built => {
  const params = [doc.guestName, doc.homestayName || 'your homestay'];
  return {
    event: 'ADVANCE_EXPIRED_GUEST',
    context: ctxOf(doc),
    params,
    text: `Hello ${params[0]}, the temporary hold on your cab booking has expired. Please contact ${params[1]} if you would like to request a new cab.`,
  };
};

export const quoteAcceptedDriverMessage = (driverName: string, reference: string): Built => ({
  event: 'QUOTE_ACCEPTED_DRIVER',
  context: { ref: reference },
  params: [driverName, reference],
  text: `Hello ${driverName}, your fare quote for trip ${reference} has been accepted. The booking will be confirmed once the guest completes the advance payment. Passenger contact details will be shared then.`,
});

/** Guest sees the driver and the advance to pay, but not the driver's phone yet. */
export const quoteAcceptedGuestMessage = (doc: any, link: string, windowMin: number): Built => {
  // {{7}} is the deadline phrase; with no deadline set it still has a value (templates need every variable)
  const params = [doc.guestName, doc.assignedDriverName || 'Your driver', vehicleText(doc), rupees(doc.agreedFare), rupees(doc.advanceAmount), link, windowMin > 0 ? `within ${windowMin} minutes` : 'soon'];
  return {
    event: 'QUOTE_ACCEPTED_GUEST',
    context: ctxOf(doc),
    params,
    text:
      `Namaste ${params[0]}, a verified driver is reserved for your trip.\n` +
      `Driver: ${params[1]}\n` +
      `Vehicle: ${params[2]}\n` +
      `Total fare: ${params[3]}\n\n` +
      `Please pay the advance booking fee of ${params[4]} here: ${params[5]}\n` +
      `Please pay ${params[6]} to confirm your cab. The rest is paid in cash to your driver at the destination.\n\n` +
      `Driver contact details will be shared as soon as the advance is paid.`,
  };
};

/** After the advance: the guest gets the driver's phone and the plan. */
export const advancePaidGuestMessage = (doc: any): Built => {
  const passUrl = `https://staycabs.in/cab-request?ref=${doc.reference || ''}`;
  const params = [
    doc.guestName,
    doc.assignedDriverName || 'Your driver',
    doc.assignedDriverPhone || '',
    vehicleText(doc),
    routeText(doc),
    whenText(doc),
    rupees(doc.remainingCashAmount),
    passUrl,
  ];
  return {
    event: 'ADVANCE_PAID_GUEST',
    context: ctxOf(doc),
    params,
    text:
      `Namaste ${params[0]}, your cab booking is confirmed.\n` +
      `Driver: ${params[1]}, phone ${params[2]}\n` +
      `Vehicle: ${params[3]}\n` +
      `Route: ${params[4]}\n` +
      `Pickup: ${params[5]}\n\n` +
      `The remaining fare of ${params[6]} is paid in cash to your driver at drop-off.\n` +
      `Track your cab and view your trip pass here: ${params[7]}\n` +
      `Have a safe journey.`,
  };
};

/** Boarding PIN on its own: Meta only allows a code in an AUTHENTICATION template ("{{1}} is your verification code"). */
export const boardingPinGuestMessage = (pin: string): Built => ({
  event: 'BOARDING_PIN_GUEST',
  params: [pin],
  text: `${pin} is your boarding PIN. Share it with your driver at pickup.`,
});

/** After the advance: the driver gets the guest's phone and the plan. */
export const advancePaidDriverMessage = (doc: any, driverLink?: string): Built => {
  const tripUrl = driverLink || `https://staycabs.in/driver-quote?t=${doc.reference || ''}`;
  const params = [
    doc.assignedDriverName || 'Driver',
    doc.reference || '',
    doc.guestName,
    doc.guestPhone || '',
    routeText(doc),
    whenText(doc),
    rupees(doc.remainingCashAmount),
    tripUrl,
  ];
  return {
    event: 'ADVANCE_PAID_DRIVER',
    context: ctxOf(doc),
    params,
    text:
      `Hello ${params[0]}, the online booking fee is received and trip ${params[1]} is confirmed.\n` +
      `Passenger: ${params[2]}, phone ${params[3]}\n` +
      `Route: ${params[4]}\n` +
      `Pickup: ${params[5]}\n\n` +
      `Collect your cash fare of ${params[6]} directly from the passenger at drop-off.\n` +
      `Open the trip details here: ${params[7]} Thank you.`,
  };
};

/** The trip was cancelled (by the homestay or StayRide, or it expired: `reason`); a paid advance is refunded. */
export const tripCancelledGuestMessage = (doc: any, reason?: string): Built => {
  const money = doc.advancePaid ? `Your advance of ${rupees(doc.advanceAmount)} will be refunded.` : 'No charge was made.';
  const params = [doc.guestName, doc.reference, whenText(doc), reason ? `${reason}. ${money}` : money];
  return {
    event: 'TRIP_CANCELLED_GUEST',
    context: ctxOf(doc),
    params,
    text: `Hello ${params[0]}, your cab request ${params[1]} for ${params[2]} has been cancelled. ${params[3]}`,
  };
};

/** The platform refunded the advance. */
export const refundGuestMessage = (doc: any, reference: string): Built => {
  const params = [doc.guestName, rupees(doc.advanceAmount), doc.reference, reference];
  return {
    event: 'REFUND_GUEST',
    context: ctxOf(doc),
    params,
    text: `Hi ${params[0]}, ${config.appName} has refunded your advance of ${params[1]} for trip ${params[2]} (reference ${params[3]}). Your bank may take a few days to show it.`,
  };
};

/** Owner assigned one of their own drivers, who may not have the app. */
export const tripAssignedDriverMessage = (homestayName: string, trip: { driverName: string; guestName: string; phone: string; pickup: string; destination: string; date: number; time: string }): Built => {
  const when = `${new Date(trip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} at ${trip.time}`;
  const params = [trip.driverName, homestayName, trip.guestName, trip.phone, `${trip.pickup} → ${trip.destination}`, when];
  return {
    event: 'TRIP_ASSIGNED_DRIVER',
    params,
    text:
      `Hi ${params[0]}, ${params[1]} has assigned you a trip.\n` +
      `Guest: ${params[2]} (${params[3]})\nRoute: ${params[4]}\nWhen: ${params[5]}`,
  };
};

/** Automated ride completion reminder for drivers 2+ hours past pickup time. */
export const completionReminderDriverMessage = (doc: any, driverLink: string): Built => {
  const params = [doc.assignedDriverName || 'Driver', doc.guestName, rupees(doc.remainingCashAmount), doc.reference, driverLink];
  return {
    event: 'COMPLETION_REMINDER_DRIVER',
    context: ctxOf(doc),
    params,
    text:
      `Hello ${params[0]},\n` +
      `Have you completed the trip for ${params[1]} (${params[3]})?\n` +
      `Please confirm cash collection of ${params[2]} and tap to complete the ride:\n${params[4]}`,
  };
};

/** Alert to homestay owner when 0 bids arrive within the bidding window. */
export const biddingTimeoutOwnerMessage = (doc: any, homestayName: string, ownerUrl: string): Built => {
  const params = [homestayName, doc.guestName, doc.reference, routeText(doc), ownerUrl];
  return {
    event: 'BIDDING_TIMEOUT_OWNER',
    context: ctxOf(doc),
    params,
    text:
      `Namaste ${params[0]},\n` +
      `No driver bids have been received yet for ${params[1]}'s cab request (${params[2]}).\n` +
      `Route: ${params[3]}\n\n` +
      `Please tap here to assign an in-house driver or expand the search radius:\n${params[4]}`,
  };
};

/** Welcome alert to newly registered drivers */
export const driverWelcomeMessage = (driverName: string, vehiclePlate: string): Built => {
  const params = [driverName, vehiclePlate];
  return {
    event: 'DRIVER_WELCOME',
    params,
    text:
      `Namaste ${params[0]}!\n` +
      `Your driver registration (${params[1]}) has been submitted to ${config.appName}.\n\n` +
      `Our operations team will review your vehicle details shortly. Once approved, you will receive trip booking alerts directly on this WhatsApp number.\n\n` +
      `Happy driving with ${config.appName}!`,
  };
};

/** Driver Wallet Payout Settled WhatsApp notification */
export const driverPayoutSettledMessage = (amount: number, utr: string): Built => {
  const params = [amount.toLocaleString('en-IN'), utr];
  return {
    event: 'PAYOUT_SETTLED_DRIVER',
    params,
    text: `${config.appName} Payout: ₹${params[0]} has been sent to your UPI account (Bank UTR: ${params[1]}).`,
  };
};

/** Driver Wallet Payout Rejected WhatsApp notification */
export const driverPayoutRejectedMessage = (amount: number, reason: string): Built => {
  const params = [amount.toLocaleString('en-IN'), reason];
  return {
    event: 'PAYOUT_REJECTED_DRIVER',
    params,
    text: `${config.appName} Payout: Your payout request of ₹${params[0]} was declined (${params[1]}). Your wallet balance is restored.`,
  };
};

/** Vehicle standby plate update alert to guest */
export const vehicleUpdatedGuestMessage = (guestName: string, reference: string, newPlate: string, driverName?: string, otp?: string): Built => {
  const pinLine = otp ? `\nYour boarding PIN remains: ${otp}` : '';
  const driverLine = driverName ? ` (Driver: ${driverName})` : '';
  const params = [guestName, reference, newPlate];
  return {
    event: 'VEHICLE_UPDATED_GUEST',
    context: { ref: reference },
    params,
    text:
      `Notice for trip ${params[1]}:\n` +
      `Your assigned vehicle plate has been updated to ${params[2]}${driverLine}.${pinLine}\n\n` +
      `Please look out for this registration plate upon pickup.`,
  };
};

