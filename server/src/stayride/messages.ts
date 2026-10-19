// Wording of every WhatsApp message StayRide sends from the company number.
// Each builder returns the template variables ({{1}}, {{2}}... in order) and the same message as plain
// text. Keep the two in step: the approved Meta template body must use these variables in this order.
//
// Privacy rule from the cab flow: the guest never gets the driver's phone, and the driver never gets
// the guest's phone, until the advance is paid (ADVANCE_PAID_* messages only).
import type { WhatsAppMessage } from '../services/whatsapp.service.js';

type Built = Omit<WhatsAppMessage, 'to'>;

const rupees = (n: unknown) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const whenText = (doc: any) =>
  `${new Date(doc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} at ${doc.time}`;
const routeText = (doc: any) => {
  const stops = (doc.destinations || []).map((d: any) => d.address).filter(Boolean);
  return [doc.pickupLocation?.address, ...stops].filter(Boolean).join(' → ') || 'Local trip';
};
const vehicleText = (doc: any) => [doc.vehicleDetails?.model, doc.vehicleDetails?.plate].filter(Boolean).join(' ') || doc.vehicleType || 'Cab';

export const askCabMessage = (guestName: string, homestayName: string, link: string): Built => ({
  event: 'ASK_CAB',
  params: [guestName, homestayName, link],
  text:
    `Namaste ${guestName}! 🙏\n` +
    `Need an airport pickup, sightseeing or a hill cab during your stay at ${homestayName}?\n\n` +
    `Tell us where you want to go and we will find a verified local driver:\n${link}`,
});

export const newRequestMessage = (doc: any): Built => {
  const params = [doc.homestayName || 'a homestay', routeText(doc), whenText(doc)];
  return {
    event: 'NEW_REQUEST',
    params,
    text:
      `New trip request from ${params[0]}\n` +
      `Route: ${params[1]}\nWhen: ${params[2]}\nVehicle: ${doc.vehicleType}\n\n` +
      `Open the StayRide app to send your quote.`,
  };
};

export const quoteAcceptedDriverMessage = (driverName: string, reference: string): Built => ({
  event: 'QUOTE_ACCEPTED_DRIVER',
  params: [driverName, reference],
  text: `Hi ${driverName}, your quote for trip ${reference} was accepted. The trip is yours once the guest pays the advance. We will send the guest details then.`,
});

/** Guest sees the driver and the advance to pay, but not the driver's phone yet. */
export const quoteAcceptedGuestMessage = (doc: any, link: string, windowMin: number): Built => {
  // {{7}} is the deadline phrase; with no deadline set it still has a value (templates need every variable)
  const params = [doc.guestName, doc.assignedDriverName || 'Your driver', vehicleText(doc), rupees(doc.agreedFare), rupees(doc.advanceAmount), link, windowMin > 0 ? `within ${windowMin} minutes` : 'soon'];
  return {
    event: 'QUOTE_ACCEPTED_GUEST',
    params,
    text:
      `Hi ${params[0]}, your cab is almost booked! 🚗\n` +
      `Driver: ${params[1]}\nVehicle: ${params[2]}\nFare: ${params[3]}\n\n` +
      `Pay the advance of ${params[4]} ${params[6]} to confirm. The balance goes to the driver in cash.\n${params[5]}\n\n` +
      `The driver's phone number is shared once the advance is paid.`,
  };
};

/** After the advance: the guest gets the driver's phone and the plan. */
export const advancePaidGuestMessage = (doc: any): Built => {
  const params = [doc.guestName, doc.assignedDriverName || 'Your driver', doc.assignedDriverPhone || '', vehicleText(doc), routeText(doc), whenText(doc), rupees(doc.remainingCashAmount)];
  return {
    event: 'ADVANCE_PAID_GUEST',
    params,
    text:
      `Hi ${params[0]}, your cab is confirmed! ✅\n` +
      `Driver: ${params[1]} (${params[2]})\nVehicle: ${params[3]}\nRoute: ${params[4]}\nWhen: ${params[5]}\n` +
      `Pay the driver ${params[6]} in cash on the trip.`,
  };
};

/** After the advance: the driver gets the guest's phone and the plan. */
export const advancePaidDriverMessage = (doc: any): Built => {
  const params = [doc.assignedDriverName || 'Driver', doc.guestName, doc.guestPhone || '', routeText(doc), whenText(doc), rupees(doc.remainingCashAmount)];
  return {
    event: 'ADVANCE_PAID_DRIVER',
    params,
    text:
      `Hi ${params[0]}, the advance is paid. Trip confirmed! ✅\n` +
      `Guest: ${params[1]} (${params[2]})\nRoute: ${params[3]}\nWhen: ${params[4]}\n` +
      `Collect ${params[5]} in cash from the guest.`,
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
