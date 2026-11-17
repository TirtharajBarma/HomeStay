import mongoose from "mongoose";
import { getWhatsappContactModel, IWhatsappContact } from "../models/whatsapp-contact.model.js";
import { getWhatsappConversationModel, IWhatsappConversation, WhatsappConversationStatus } from "../models/whatsapp-conversation.model.js";
import { getWhatsappMessageModel, IWhatsappMessage, WhatsappDeliveryStatus, WhatsappDirection, WhatsappMessageType, WhatsappSenderType } from "../models/whatsapp-message.model.js";
import { Guest } from "../models/guest.model.js";
import { Booking } from "../models/booking.model.js";
import { Driver } from "../models/driver.model.js";
import { getCabRequestModel } from "../models/cab-request.model.js";
import { getStayRideTenantModel } from "../stayride/store.js";
import { toWhatsAppNumber, sendWhatsApp, WhatsAppMessage, WhatsAppEvent } from "./whatsapp.service.js";
import { emitWhatsAppMessage, emitWhatsAppConversation, emitWhatsAppStatus } from "./socket.service.js";
import { tenantDbModel } from "../utils/tenant-model.js";
import { logger } from "../utils/logger.js";
import { httpError } from "../middlewares/error-handler.js";
import { CommissionService } from "./commission.service.js";

export interface TemplateDefinition {
  id: string;
  name: string;
  event: WhatsAppEvent;
  title: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  language: string;
  description: string;
  variables: Array<{
    index: number;
    name: string;
    description: string;
    placeholder: string;
    sample: string;
  }>;
  formatText: (params: string[]) => string;
}

export const APPROVED_TEMPLATES: TemplateDefinition[] = [
  {
    id: "ask_cab",
    name: "ask_cab",
    event: "ASK_CAB",
    title: "Ask for Cab / Welcome Greeting",
    category: "UTILITY",
    language: "en",
    description: "Welcome guests to the homestay and offer local airport transfer or sightseeing cab assistance.",
    variables: [
      { index: 1, name: "Guest Name", description: "Name of the passenger or guest", placeholder: "e.g. Rahul Sharma", sample: "Rahul Sharma" },
      { index: 2, name: "Homestay Name", description: "Name of the booked homestay property", placeholder: "e.g. Pine Ridge Retreat", sample: "Pine Ridge Retreat" },
      { index: 3, name: "Booking Link", description: "Web link to request a cab", placeholder: "e.g. https://staycabs.in/cab-request?ref=...", sample: "https://staycabs.in/cab-request?ref=DEMO123" },
    ],
    formatText: (p) =>
      `Namaste ${p[0] || "[Guest Name]"}.\nIf you need an airport transfer, sightseeing, or a local hill cab during your stay at ${p[1] || "[Homestay]"}, please share your itinerary and we will arrange a verified driver for you:\n${p[2] || "[Link]"}`,
  },
  {
    id: "new_trip_request",
    name: "new_trip_request",
    event: "NEW_REQUEST",
    title: "New Trip Request (Driver Broadcast)",
    category: "UTILITY",
    language: "en",
    description: "Broadcast new passenger ride request to registered hill cab drivers.",
    variables: [
      { index: 1, name: "Partner / Homestay", description: "Homestay or StayCabs partner name", placeholder: "e.g. StayCabs Partner", sample: "StayCabs Partner" },
      { index: 2, name: "Route", description: "Origin to destination description", placeholder: "e.g. Bagdogra Airport → Darjeeling Mall Road", sample: "Bagdogra Airport → Darjeeling Mall Road" },
      { index: 3, name: "Pickup When", description: "Date and time of pickup", placeholder: "e.g. 18 Nov at 10:00 AM", sample: "18 Nov at 10:00 AM" },
      { index: 4, name: "Vehicle Type", description: "Required vehicle class", placeholder: "e.g. SUV", sample: "SUV" },
      { index: 5, name: "Quote URL", description: "Direct link for driver to submit quote", placeholder: "e.g. https://staycabs.in/driver-quote?t=...", sample: "https://staycabs.in/driver-quote?t=SAMPLE" },
    ],
    formatText: (p) =>
      `New trip request from ${p[0] || "[Partner]"}.\nRoute: ${p[1] || "[Route]"}\nPickup: ${p[2] || "[Pickup]"}\nVehicle: ${p[3] || "[Vehicle]"}\n\nSubmit your total trip fare quotation here: ${p[4] || "[Link]"}`,
  },
  {
    id: "quote_accepted_guest",
    name: "quote_accepted_guest",
    event: "QUOTE_ACCEPTED_GUEST",
    title: "Driver Reserved (Guest Advance)",
    category: "UTILITY",
    language: "en",
    description: "Notify guest that driver is reserved and request advance booking fee payment.",
    variables: [
      { index: 1, name: "Guest Name", description: "Passenger name", placeholder: "e.g. Priya", sample: "Priya" },
      { index: 2, name: "Driver Name", description: "Assigned driver name", placeholder: "e.g. Tenzing Sherpa", sample: "Tenzing Sherpa" },
      { index: 3, name: "Vehicle Model", description: "Vehicle type and model", placeholder: "e.g. Toyota Innova Crysta", sample: "Toyota Innova Crysta" },
      { index: 4, name: "Total Fare", description: "Agreed total trip fare in ₹", placeholder: "e.g. ₹3,500", sample: "₹3,500" },
      { index: 5, name: "Advance Amount", description: "Advance online booking fee", placeholder: "e.g. ₹700", sample: "₹700" },
      { index: 6, name: "Payment Link", description: "Secure link to pay advance", placeholder: "e.g. https://staycabs.in/pay/...", sample: "https://staycabs.in/pay/SAMPLE" },
      { index: 7, name: "Deadline Window", description: "Payment hold deadline", placeholder: "e.g. within 30 minutes", sample: "within 30 minutes" },
    ],
    formatText: (p) =>
      `Namaste ${p[0] || "[Guest]"},\nA verified driver is reserved for your trip.\nDriver: ${p[1] || "[Driver]"}\nVehicle: ${p[2] || "[Vehicle]"}\nTotal fare: ${p[3] || "[Fare]"}\n\nPlease pay the advance booking fee of ${p[4] || "[Advance]"} here: ${p[5] || "[Link]"}\nPlease pay ${p[6] || "soon"} to confirm your cab. The rest is paid in cash to your driver at drop-off.`,
  },
  {
    id: "advance_paid_guest",
    name: "advance_paid_guest",
    event: "ADVANCE_PAID_GUEST",
    title: "Booking Confirmed (Guest Pass)",
    category: "UTILITY",
    language: "en",
    description: "Send trip confirmation, driver phone and live pass URL to passenger after advance payment.",
    variables: [
      { index: 1, name: "Guest Name", description: "Passenger name", placeholder: "e.g. Rahul Sharma", sample: "Rahul Sharma" },
      { index: 2, name: "Driver Name", description: "Driver name", placeholder: "e.g. Dorjee Tamang", sample: "Dorjee Tamang" },
      { index: 3, name: "Driver Phone", description: "Driver contact number", placeholder: "e.g. +91 98320 12345", sample: "+91 98320 12345" },
      { index: 4, name: "Vehicle", description: "Vehicle details", placeholder: "e.g. Mahindra Scorpio WB-74-A-1234", sample: "Mahindra Scorpio WB-74-A-1234" },
      { index: 5, name: "Route", description: "Pickup and destination route", placeholder: "e.g. Siliguri → Gangtok", sample: "Siliguri → Gangtok" },
      { index: 6, name: "Pickup When", description: "Pickup time", placeholder: "e.g. 19 Nov at 08:30 AM", sample: "19 Nov at 08:30 AM" },
      { index: 7, name: "Remaining Cash", description: "Balance cash due to driver", placeholder: "e.g. ₹2,800", sample: "₹2,800" },
      { index: 8, name: "Trip Pass URL", description: "Live tracking pass link", placeholder: "e.g. https://staycabs.in/cab-request?ref=...", sample: "https://staycabs.in/cab-request?ref=TRIP01" },
    ],
    formatText: (p) =>
      `Namaste ${p[0] || "[Guest]"},\nYour cab booking is confirmed.\nDriver: ${p[1] || "[Driver]"}, phone ${p[2] || "[Phone]"}\nVehicle: ${p[3] || "[Vehicle]"}\nRoute: ${p[4] || "[Route]"}\nPickup: ${p[5] || "[Pickup]"}\n\nThe remaining fare of ${p[6] || "[Cash]"} is paid in cash to your driver at drop-off.\nTrack your cab and view your trip pass here: ${p[7] || "[Link]"}\nHave a safe journey.`,
  },
  {
    id: "boarding_pin_guest",
    name: "boarding_pin_guest",
    event: "BOARDING_PIN_GUEST",
    title: "Boarding PIN (Authentication)",
    category: "AUTHENTICATION",
    language: "en",
    description: "Send 4-digit boarding security PIN to guest.",
    variables: [
      { index: 1, name: "4-Digit PIN", description: "Security verification PIN", placeholder: "e.g. 4821", sample: "4821" },
    ],
    formatText: (p) => `${p[0] || "XXXX"} is your boarding PIN. Share it with your driver at pickup.`,
  },
  {
    id: "advance_paid_driver",
    name: "advance_paid_driver",
    event: "ADVANCE_PAID_DRIVER",
    title: "Trip Confirmed (Driver Dispatch)",
    category: "UTILITY",
    language: "en",
    description: "Notify driver that passenger advance is received and provide passenger contact.",
    variables: [
      { index: 1, name: "Driver Name", description: "Driver name", placeholder: "e.g. Dorjee Tamang", sample: "Dorjee Tamang" },
      { index: 2, name: "Reference", description: "Trip booking reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
      { index: 3, name: "Passenger Name", description: "Guest name", placeholder: "e.g. Rahul Sharma", sample: "Rahul Sharma" },
      { index: 4, name: "Passenger Phone", description: "Guest phone number", placeholder: "e.g. +91 98765 43210", sample: "+91 98765 43210" },
      { index: 5, name: "Route", description: "Route description", placeholder: "e.g. NJP Station → Darjeeling", sample: "NJP Station → Darjeeling" },
      { index: 6, name: "Pickup Time", description: "Pickup schedule", placeholder: "e.g. 20 Nov at 11:00 AM", sample: "20 Nov at 11:00 AM" },
      { index: 7, name: "Cash to Collect", description: "Cash to collect at destination", placeholder: "e.g. ₹2,500", sample: "₹2,500" },
      { index: 8, name: "Trip Action URL", description: "Driver trip web page", placeholder: "e.g. https://staycabs.in/driver-quote?t=...", sample: "https://staycabs.in/driver-quote?t=TRIP01" },
    ],
    formatText: (p) =>
      `Hello ${p[0] || "[Driver]"},\nThe online booking fee is received and trip ${p[1] || "[Ref]"} is confirmed.\nPassenger: ${p[2] || "[Passenger]"}, phone ${p[3] || "[Phone]"}\nRoute: ${p[4] || "[Route]"}\nPickup: ${p[5] || "[Pickup]"}\n\nCollect your cash fare of ${p[6] || "[Cash]"} directly from the passenger at drop-off.\nOpen trip details here: ${p[7] || "[Link]"}\nThank you.`,
  },
  {
    id: "trip_assigned_driver",
    name: "trip_assigned_driver",
    event: "TRIP_ASSIGNED_DRIVER",
    title: "Trip Assigned to Driver",
    category: "UTILITY",
    language: "en",
    description: "Notify in-house or designated fleet driver of an assigned trip.",
    variables: [
      { index: 1, name: "Driver Name", description: "Assigned driver name", placeholder: "e.g. Karma", sample: "Karma" },
      { index: 2, name: "Homestay Name", description: "Homestay property", placeholder: "e.g. Himalayan Homestay", sample: "Himalayan Homestay" },
      { index: 3, name: "Guest Name", description: "Passenger name", placeholder: "e.g. Amit Sen", sample: "Amit Sen" },
      { index: 4, name: "Guest Phone", description: "Passenger phone", placeholder: "e.g. +91 98765 43210", sample: "+91 98765 43210" },
      { index: 5, name: "Route", description: "Trip route", placeholder: "e.g. Homestay → Tiger Hill", sample: "Homestay → Tiger Hill" },
      { index: 6, name: "When", description: "Pickup schedule", placeholder: "e.g. 21 Nov at 04:00 AM", sample: "21 Nov at 04:00 AM" },
    ],
    formatText: (p) =>
      `Hi ${p[0] || "[Driver]"},\n${p[1] || "[Homestay]"} has assigned you a trip.\nGuest: ${p[2] || "[Guest]"} (${p[3] || "[Phone]"})\nRoute: ${p[4] || "[Route]"}\nWhen: ${p[5] || "[When]"}`,
  },
  {
    id: "quote_counter",
    name: "quote_counter",
    event: "QUOTE_COUNTER",
    title: "Counter-Offer to Driver",
    category: "UTILITY",
    language: "en",
    description: "Inform driver of homestay counter-offer.",
    variables: [
      { index: 1, name: "Driver Name", description: "Driver name", placeholder: "e.g. Pemba", sample: "Pemba" },
      { index: 2, name: "Reference", description: "Trip reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
      { index: 3, name: "Counter Fare", description: "Proposed fare in ₹", placeholder: "e.g. ₹2,800", sample: "₹2,800" },
      { index: 4, name: "Quote URL", description: "Link to accept or reject counter", placeholder: "e.g. https://staycabs.in/...", sample: "https://staycabs.in/quote/123" },
    ],
    formatText: (p) =>
      `Hello ${p[0] || "[Driver]"},\nThe homestay has made a counter-offer of ${p[2] || "[Counter Fare]"} for trip ${p[1] || "[Ref]"}.\nYou can accept this offer or keep your original fare here:\n${p[3] || "[Link]"}`,
  },
  {
    id: "trip_cancelled_guest",
    name: "trip_cancelled_guest",
    event: "TRIP_CANCELLED_GUEST",
    title: "Trip Cancelled (Guest Notification)",
    category: "UTILITY",
    language: "en",
    description: "Notify guest of trip cancellation and refund status.",
    variables: [
      { index: 1, name: "Guest Name", description: "Guest name", placeholder: "e.g. Ananya", sample: "Ananya" },
      { index: 2, name: "Reference", description: "Trip reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
      { index: 3, name: "When", description: "Original pickup schedule", placeholder: "e.g. 19 Nov at 10:00 AM", sample: "19 Nov at 10:00 AM" },
      { index: 4, name: "Cancellation Details", description: "Reason and refund status", placeholder: "e.g. Bad weather. Your advance of ₹600 will be refunded.", sample: "Your advance will be refunded." },
    ],
    formatText: (p) =>
      `Hello ${p[0] || "[Guest]"},\nYour cab request ${p[1] || "[Ref]"} for ${p[2] || "[When]"} has been cancelled. ${p[3] || ""}`,
  },
  {
    id: "refund_guest",
    name: "refund_guest",
    event: "REFUND_GUEST",
    title: "Refund Processed (Guest)",
    category: "UTILITY",
    language: "en",
    description: "Notify guest that advance payment refund was issued.",
    variables: [
      { index: 1, name: "Guest Name", description: "Passenger name", placeholder: "e.g. Ananya", sample: "Ananya" },
      { index: 2, name: "Refund Amount", description: "Refunded amount in ₹", placeholder: "e.g. ₹600", sample: "₹600" },
      { index: 3, name: "Trip Reference", description: "Booking reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
      { index: 4, name: "Bank Reference / UTR", description: "Payment gateway reference", placeholder: "e.g. RFND-123456", sample: "RFND-123456" },
    ],
    formatText: (p) =>
      `Hi ${p[0] || "[Guest]"},\nStayCabs has refunded your advance of ${p[1] || "[Amount]"} for trip ${p[2] || "[Ref]"} (reference ${p[3] || "[UTR]"}). Your bank may take a few days to show it.`,
  },
  {
    id: "completion_reminder_driver",
    name: "completion_reminder_driver",
    event: "COMPLETION_REMINDER_DRIVER",
    title: "Ride Completion Reminder",
    category: "UTILITY",
    language: "en",
    description: "Remind driver to confirm cash collection and close completed trip.",
    variables: [
      { index: 1, name: "Driver Name", description: "Driver name", placeholder: "e.g. Tenzing", sample: "Tenzing" },
      { index: 2, name: "Guest Name", description: "Passenger name", placeholder: "e.g. Rahul", sample: "Rahul" },
      { index: 3, name: "Cash Fare", description: "Remaining cash collected", placeholder: "e.g. ₹2,200", sample: "₹2,200" },
      { index: 4, name: "Reference", description: "Trip reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
      { index: 5, name: "Completion URL", description: "One-tap completion link", placeholder: "e.g. https://staycabs.in/...", sample: "https://staycabs.in/trip/complete" },
    ],
    formatText: (p) =>
      `Hello ${p[0] || "[Driver]"},\nHave you completed the trip for ${p[1] || "[Guest]"} (${p[3] || "[Ref]"})?\nPlease confirm cash collection of ${p[2] || "[Cash]"} and tap to complete the ride:\n${p[4] || "[Link]"}`,
  },
  {
    id: "driver_welcome",
    name: "driver_welcome",
    event: "DRIVER_WELCOME",
    title: "Driver Welcome & Registration Alert",
    category: "UTILITY",
    language: "en",
    description: "Welcome newly registered hill driver and confirm document review.",
    variables: [
      { index: 1, name: "Driver Name", description: "Registered driver name", placeholder: "e.g. Passang Lepcha", sample: "Passang Lepcha" },
      { index: 2, name: "Vehicle Plate", description: "Vehicle registration number", placeholder: "e.g. SK-01-A-4567", sample: "SK-01-A-4567" },
    ],
    formatText: (p) =>
      `Namaste ${p[0] || "[Driver]"}!\nYour driver registration (${p[1] || "[Plate]"}) has been submitted to StayCabs.\nOur operations team will review your vehicle details shortly. Once approved, you will receive trip booking alerts directly on this WhatsApp number.\nHappy driving with StayCabs!`,
  },
  {
    id: "driver_payout_settled",
    name: "driver_payout_settled",
    event: "PAYOUT_SETTLED_DRIVER",
    title: "Driver Payout Settled (Bank UTR)",
    category: "UTILITY",
    language: "en",
    description: "Notify driver that wallet payout has been settled to their UPI / bank account.",
    variables: [
      { index: 1, name: "Payout Amount", description: "Settled amount in ₹", placeholder: "e.g. 5,000", sample: "5,000" },
      { index: 2, name: "Bank UTR", description: "UPI transaction reference / UTR", placeholder: "e.g. 423456789012", sample: "423456789012" },
    ],
    formatText: (p) => `StayCabs Payout: ₹${p[0] || "[Amount]"} has been sent to your UPI account (Bank UTR: ${p[1] || "[UTR]"}).`,
  },
  {
    id: "quote_accepted_driver",
    name: "quote_accepted_driver",
    event: "QUOTE_ACCEPTED_DRIVER",
    title: "Driver Quote Accepted (Payment Hold)",
    category: "UTILITY",
    language: "en",
    description: "Notify driver that their quote was accepted and customer advance payment is pending.",
    variables: [
      { index: 1, name: "Driver Name", description: "Driver name", placeholder: "e.g. Tenzing", sample: "Tenzing" },
      { index: 2, name: "Trip Reference", description: "Trip booking reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
    ],
    formatText: (p) =>
      `Hello ${p[0] || "[Driver]"},\nYour quotation for trip ${p[1] || "[Ref]"} has been accepted by the guest.\nWe are waiting for the online advance payment hold to confirm your ride.\nStay prepared.`,
  },
  {
    id: "advance_expired_guest",
    name: "advance_expired_guest",
    event: "ADVANCE_EXPIRED_GUEST",
    title: "Payment Window Expired (Guest Alert)",
    category: "UTILITY",
    language: "en",
    description: "Inform guest that the 30-minute advance hold expired and invite them to re-request.",
    variables: [
      { index: 1, name: "Guest Name", description: "Guest name", placeholder: "e.g. Rahul", sample: "Rahul" },
      { index: 2, name: "Trip Reference", description: "Booking reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
    ],
    formatText: (p) =>
      `Namaste ${p[0] || "[Guest]"}.\nThe advance booking hold for cab request ${p[1] || "[Ref]"} has expired.\nYou can submit a fresh request at https://staycabs.in/cab-request whenever you are ready.`,
  },
  {
    id: "vehicle_updated_guest",
    name: "vehicle_updated_guest",
    event: "VEHICLE_UPDATED_GUEST",
    title: "Vehicle / Driver Updated (Guest)",
    category: "UTILITY",
    language: "en",
    description: "Notify guest of an updated vehicle plate or replacement driver.",
    variables: [
      { index: 1, name: "Guest Name", description: "Guest name", placeholder: "e.g. Rahul", sample: "Rahul" },
      { index: 2, name: "Trip Reference", description: "Booking reference", placeholder: "e.g. REQ-9F2A61", sample: "REQ-9F2A61" },
      { index: 3, name: "New Plate Number", description: "Updated vehicle plate", placeholder: "e.g. WB-74-A-9999", sample: "WB-74-A-9999" },
      { index: 4, name: "Driver Name", description: "Driver name", placeholder: "e.g. Passang", sample: "Passang" },
      { index: 5, name: "Boarding PIN", description: "Security PIN", placeholder: "e.g. 4821", sample: "4821" },
    ],
    formatText: (p) =>
      `Namaste ${p[0] || "[Guest]"},\nYour assigned cab for trip ${p[1] || "[Ref]"} has been updated.\nDriver: ${p[3] || "Verified Driver"}\nVehicle Plate: ${p[2] || "[Plate]"}\nBoarding PIN: ${p[4] || "----"}\nPlease verify this registration at pickup.`,
  },
  {
    id: "driver_payout_rejected",
    name: "driver_payout_rejected",
    event: "PAYOUT_REJECTED_DRIVER",
    title: "Driver Payout Rejected",
    category: "UTILITY",
    language: "en",
    description: "Notify driver that withdrawal request was rejected and specify reason.",
    variables: [
      { index: 1, name: "Payout Amount", description: "Rejected amount in ₹", placeholder: "e.g. 3,000", sample: "3,000" },
      { index: 2, name: "Rejection Reason", description: "Specific reason for rejection", placeholder: "e.g. Incorrect UPI ID", sample: "Invalid UPI handle" },
    ],
    formatText: (p) =>
      `StayCabs Payout: Your payout request of ₹${p[0] || "[Amount]"} could not be settled.\nReason: ${p[1] || "[Reason]"}.\nPlease update your bank/UPI details in the StayRide Driver App.`,
  },
  {
    id: "bidding_timeout_owner",
    name: "bidding_timeout_owner",
    event: "BIDDING_TIMEOUT_OWNER",
    title: "Driver Bidding Timeout (Owner Alert)",
    category: "UTILITY",
    language: "en",
    description: "Alert homestay host that no hill driver quoted for guest trip.",
    variables: [
      { index: 1, name: "Homestay Name", description: "Property name", placeholder: "e.g. Pine Ridge", sample: "Pine Ridge" },
      { index: 2, name: "Guest Name", description: "Guest name", placeholder: "e.g. Rahul", sample: "Rahul" },
      { index: 3, name: "Pickup Point", description: "Pickup location address", placeholder: "e.g. Bagdogra Airport", sample: "Bagdogra Airport" },
      { index: 4, name: "Homestay Portal URL", description: "Host action link", placeholder: "e.g. https://staycabs.in/owner", sample: "https://staycabs.in/owner" },
    ],
    formatText: (p) =>
      `Alert for ${p[0] || "[Homestay]"}:\nNo hill driver has quoted for guest ${p[1] || "[Guest]"}'s trip from ${p[2] || "[Pickup]"} yet.\nPlease review the request or assign an in-house fleet vehicle:\n${p[3] || "[Link]"}`,
  },
];

export class WhatsappInboxService {
  /**
   * Normalize phone number to standard E.164 digits format (e.g. 919876543210).
   */
  static normalizePhone(phone: unknown): string {
    const wa = toWhatsAppNumber(phone);
    if (wa) return wa;
    const clean = String(phone ?? "").replace(/\D/g, "");
    if (clean.length === 10) return `91${clean}`;
    return clean;
  }

  /**
   * Extract last 10 digits for matching Indian phone numbers across diverse formats.
   */
  static last10Digits(phone: unknown): string {
    const digits = String(phone ?? "").replace(/\D/g, "");
    return digits.slice(-10);
  }

  static getGuestModel(isDemo = false): mongoose.Model<any> {
    try {
      return tenantDbModel(isDemo, "Guest", Guest.schema);
    } catch {
      return Guest;
    }
  }

  static getBookingModel(isDemo = false): mongoose.Model<any> {
    try {
      return tenantDbModel(isDemo, "Booking", Booking.schema);
    } catch {
      return Booking;
    }
  }

  /**
   * Find or create a WhatsApp contact record.
   * Auto-links to matching guest record if phone matches.
   */
  static async getOrCreateContact(
    phoneNumber: string,
    customerName?: string,
    guestId?: any,
    isDemo = false
  ): Promise<IWhatsappContact> {
    const normalized = this.normalizePhone(phoneNumber);
    const ContactModel = getWhatsappContactModel(isDemo);

    let contact: any = await ContactModel.findOne({ phoneNumber: normalized });
    if (contact) {
      let needsSave = false;
      if (customerName && (!contact.customerName || contact.customerName === normalized)) {
        contact.customerName = customerName;
        needsSave = true;
      }
      if (guestId && !contact.guestId) {
        contact.guestId = guestId;
        needsSave = true;
      }
      if (needsSave) await contact.save();
      return contact;
    }

    // Try auto-linking by phone to existing StayCabs guest / booking
    const last10 = this.last10Digits(normalized);
    let linkedGuestId = guestId || null;
    let resolvedName = customerName || "";

    if (!resolvedName && last10.length === 10) {
      try {
        const re = new RegExp(`${last10.split("").join("\\D*")}\\D*$`);
        const GuestModel = this.getGuestModel(isDemo);
        const BookingModel = this.getBookingModel(isDemo);
        const existingGuest = await GuestModel.findOne({ phone: re }).sort({ createdAt: -1 });
        if (existingGuest) {
          resolvedName = existingGuest.name;
          linkedGuestId = existingGuest._id;
        } else {
          const existingBooking = await BookingModel.findOne({ phone: re }).sort({ createdAt: -1 });
          if (existingBooking) {
            resolvedName = existingBooking.guestName;
          }
        }
      } catch (err: any) {
        logger.warn("[WhatsApp Contact] Auto-link lookup failed", { error: err?.message });
      }
    }

    contact = (await (ContactModel as any).create({
      phoneNumber: normalized,
      customerName: resolvedName || `+${normalized}`,
      guestId: linkedGuestId,
    })) as IWhatsappContact;

    return contact;
  }

  /**
   * Find or create a conversation for a contact.
   */
  static async getOrCreateConversation(
    contact: IWhatsappContact,
    isDemo = false
  ): Promise<IWhatsappConversation> {
    const ConvModel = getWhatsappConversationModel(isDemo);

    let conv: any = await ConvModel.findOne({ contactId: contact._id as any });
    if (!conv) {
      conv = (await (ConvModel as any).create({
        contactId: contact._id as any,
        phoneNumber: contact.phoneNumber,
        customerName: contact.customerName || contact.phoneNumber,
        status: "OPEN",
        unreadCount: 0,
        lastMessage: "",
        lastMessageAt: new Date(),
        lastInboundMessageAt: null,
      })) as IWhatsappConversation;
      emitWhatsAppConversation(conv);
    } else if (contact.customerName && conv.customerName !== contact.customerName) {
      conv.customerName = contact.customerName;
      await conv.save();
    }
    return conv;
  }

  /**
   * Check 24-hour customer messaging service window.
   */
  static check24HourWindow(conversation: IWhatsappConversation | any): {
    isOpen: boolean;
    lastInboundAt: Date | null;
    expiresAt: Date | null;
    remainingSeconds: number;
    reason?: string;
  } {
    const lastInbound = conversation?.lastInboundMessageAt
      ? new Date(conversation.lastInboundMessageAt)
      : null;

    if (!lastInbound || isNaN(lastInbound.getTime())) {
      return {
        isOpen: false,
        lastInboundAt: null,
        expiresAt: null,
        remainingSeconds: 0,
        reason: "No inbound message received from customer yet. Please send an approved template to initiate contact.",
      };
    }

    const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;
    const expiresAt = new Date(lastInbound.getTime() + WINDOW_DURATION_MS);
    const now = Date.now();
    const remainingMs = expiresAt.getTime() - now;

    if (remainingMs <= 0) {
      return {
        isOpen: false,
        lastInboundAt: lastInbound,
        expiresAt,
        remainingSeconds: 0,
        reason: "24-hour customer service window has expired. WhatsApp Cloud API policy requires an approved template to re-engage.",
      };
    }

    return {
      isOpen: true,
      lastInboundAt: lastInbound,
      expiresAt,
      remainingSeconds: Math.floor(remainingMs / 1000),
    };
  }

  /**
   * Fetch customer context (guest record, homestay, bookings, cab requests) for the right sidebar.
   */
  static async getCustomerContext(phoneNumber: string, isDemo = false) {
    const normalized = this.normalizePhone(phoneNumber);
    const last10 = this.last10Digits(normalized);

    const result: {
      contact: any;
      guest: any;
      driver: any;
      bookings: any[];
      latestBooking: any;
      cabBookings: any[];
      latestTrip: any;
      homestay: any;
      isExistingGuest: boolean;
      isDriver: boolean;
    } = {
      contact: null,
      guest: null,
      driver: null,
      bookings: [],
      latestBooking: null,
      cabBookings: [],
      latestTrip: null,
      homestay: null,
      isExistingGuest: false,
      isDriver: false,
    };

    const ContactModel = getWhatsappContactModel(isDemo);
    result.contact = await ContactModel.findOne({ phoneNumber: normalized });

    if (last10.length !== 10) return result;

    const phoneRegex = new RegExp(`${last10.split("").join("\\D*")}\\D*$`);

    try {
      // 1. Guest record
      const GuestModel = this.getGuestModel(isDemo);
      const guest = await GuestModel.findOne({ phone: phoneRegex }).sort({ createdAt: -1 });
      if (guest) {
        result.guest = guest;
        result.isExistingGuest = true;
      }

      // 2. Homestay bookings
      const BookingModel = this.getBookingModel(isDemo);
      const bookings = await BookingModel.find({ phone: phoneRegex }).sort({ createdAt: -1 }).limit(5);
      result.bookings = bookings;
      if (bookings.length > 0) {
        result.latestBooking = bookings[0];
        result.isExistingGuest = true;
        result.homestay = {
          name: bookings[0].homestayName || "StayCabs Homestay",
          room: bookings[0].roomName,
          propertyId: bookings[0].propertyId,
        };
      }

      // 3. StayRide Tenant Aggregate (live checkouts)
      try {
        const liveStays: any[] = await getStayRideTenantModel(isDemo).aggregate([
          { $match: { "data.bookings": { $elemMatch: { phone: phoneRegex } } } },
          { $limit: 3 },
          {
            $project: {
              _id: 0,
              tenantId: 1,
              homestayName: 1,
              booking: {
                $first: {
                  $filter: {
                    input: "$data.bookings",
                    as: "b",
                    cond: { $regexMatch: { input: { $ifNull: ["$$b.phone", ""] }, regex: phoneRegex } },
                  },
                },
              },
            },
          },
        ]);
        if (liveStays.length > 0 && !result.homestay) {
          result.homestay = {
            name: liveStays[0].homestayName,
            room: liveStays[0].booking?.roomName,
            tenantKey: liveStays[0].tenantId,
          };
          if (!result.latestBooking) {
            result.latestBooking = liveStays[0].booking;
          }
        }
      } catch {}

      // 4. Cab Requests
      const CabModel = getCabRequestModel(isDemo);
      const cabRequests = await CabModel.find({ guestPhone: phoneRegex }).sort({ createdAt: -1 }).limit(10);
      result.cabBookings = cabRequests;
      if (cabRequests.length > 0) {
        result.latestTrip = cabRequests[0];
        if (!result.homestay && cabRequests[0].homestayName) {
          result.homestay = {
            name: cabRequests[0].homestayName,
            propertyId: cabRequests[0].propertyId,
          };
        }
      }

      // 5. Driver Lookup (Hill Drivers)
      try {
        const driverDoc = await Driver.findOne({ phone: phoneRegex }).sort({ createdAt: -1 });
        if (driverDoc) {
          result.driver = driverDoc;
          result.isDriver = true;
          if (result.contact && (!result.contact.customerName || /^\+?\d+$/.test(result.contact.customerName))) {
            result.contact.customerName = driverDoc.name;
            await result.contact.save();
          }
        } else {
          const assignedTrip = await CabModel.findOne({ assignedDriverPhone: phoneRegex }).sort({ createdAt: -1 });
          if (assignedTrip) {
            result.isDriver = true;
            result.driver = {
              name: assignedTrip.assignedDriverName || "Verified Driver",
              phone: assignedTrip.assignedDriverPhone,
              vehicle: assignedTrip.vehicleType || "Cab",
              plate: assignedTrip.vehicleDetails?.plate || "",
            };
            if (result.contact && (!result.contact.customerName || /^\+?\d+$/.test(result.contact.customerName))) {
              result.contact.customerName = assignedTrip.assignedDriverName;
              await result.contact.save();
            }
          }
        }
      } catch (err: any) {
        logger.warn("[WhatsApp Context] Error looking up driver", { error: err?.message });
      }
    } catch (err: any) {
      logger.warn("[WhatsApp Context] Error assembling customer context", { error: err?.message });
    }

    return result;
  }

  /**
   * Record an outgoing WhatsApp message (automated or manual).
   * Idempotent & saves in the single persistent message store.
   */
  static async recordOutboundMessage(params: {
    to: string;
    text: string;
    whatsappMessageId?: string;
    senderType?: WhatsappSenderType;
    messageType?: WhatsappMessageType;
    templateName?: string;
    templateLanguage?: string;
    templateParameters?: any;
    mediaUrl?: string;
    mediaId?: string;
    deliveryStatus?: WhatsappDeliveryStatus;
    adminId?: any;
    customerName?: string;
    isDemo?: boolean;
    errorDetails?: string;
  }): Promise<IWhatsappMessage> {
    const isDemo = Boolean(params.isDemo);
    const normalized = this.normalizePhone(params.to);

    const contact = await this.getOrCreateContact(normalized, params.customerName, undefined, isDemo);
    const conversation = await this.getOrCreateConversation(contact, isDemo);
    const MessageModel = getWhatsappMessageModel(isDemo);

    const status: WhatsappDeliveryStatus = params.deliveryStatus || "SENT";

    // Deduplication by whatsappMessageId if provided
    if (params.whatsappMessageId) {
      const existing = await MessageModel.findOne({ whatsappMessageId: params.whatsappMessageId });
      if (existing) {
        if (params.deliveryStatus && existing.deliveryStatus !== params.deliveryStatus) {
          existing.deliveryStatus = params.deliveryStatus;
          await existing.save();
        }
        return existing;
      }
    }

    const message = (await (MessageModel as any).create({
      conversationId: conversation._id as any,
      contactId: contact._id as any,
      whatsappMessageId: params.whatsappMessageId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      direction: "OUTBOUND",
      senderType: params.senderType || (params.adminId ? "ADMIN" : "SYSTEM"),
      messageType: params.messageType || (params.templateName ? "TEMPLATE" : params.mediaUrl ? "IMAGE" : "TEXT"),
      messageContent: params.text,
      templateName: params.templateName || null,
      templateLanguage: params.templateLanguage || null,
      templateParameters: params.templateParameters || null,
      mediaUrl: params.mediaUrl || null,
      mediaId: params.mediaId || null,
      deliveryStatus: status,
      sentAt: new Date(),
      errorDetails: params.errorDetails || null,
      adminId: params.adminId || null,
    })) as IWhatsappMessage;

    // Update conversation summary
    conversation.lastMessage = params.text;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageDirection = "OUTBOUND";
    conversation.lastMessageStatus = status;
    await conversation.save();

    emitWhatsAppMessage({ conversation, message });
    emitWhatsAppConversation(conversation);

    return message;
  }

  /**
   * Record an incoming customer WhatsApp message from Meta Webhook.
   */
  static async recordInboundMessage(params: {
    from: string;
    text: string;
    whatsappMessageId: string;
    mediaType?: string;
    mediaId?: string;
    mediaUrl?: string;
    timestamp?: number;
    profileName?: string;
    isDemo?: boolean;
  }): Promise<{ message: IWhatsappMessage; conversation: IWhatsappConversation }> {
    const isDemo = Boolean(params.isDemo);
    const normalized = this.normalizePhone(params.from);

    const MessageModel = getWhatsappMessageModel(isDemo);

    // Prevent duplicate webhook processing
    if (params.whatsappMessageId) {
      const existing = await MessageModel.findOne({ whatsappMessageId: params.whatsappMessageId });
      if (existing) {
        const ConvModel = getWhatsappConversationModel(isDemo);
        const existingConv = await ConvModel.findById(existing.conversationId);
        return { message: existing, conversation: existingConv! };
      }
    }

    const contact = await this.getOrCreateContact(normalized, params.profileName, undefined, isDemo);
    const conversation = await this.getOrCreateConversation(contact, isDemo);

    const receivedAt = params.timestamp ? new Date(params.timestamp * 1000) : new Date();

    let msgType: WhatsappMessageType = "TEXT";
    if (params.mediaType === "image") msgType = "IMAGE";
    else if (params.mediaType === "document") msgType = "DOCUMENT";
    else if (params.mediaType && params.mediaType !== "text") msgType = "OTHER";

    const message = (await (MessageModel as any).create({
      conversationId: conversation._id as any,
      contactId: contact._id as any,
      whatsappMessageId: params.whatsappMessageId,
      direction: "INBOUND",
      senderType: "CUSTOMER",
      messageType: msgType,
      messageContent: params.text || `[${msgType} message]`,
      mediaId: params.mediaId || null,
      mediaUrl: params.mediaUrl || null,
      deliveryStatus: "READ",
      sentAt: receivedAt,
      deliveredAt: receivedAt,
      readAt: receivedAt,
    })) as IWhatsappMessage;

    // Update conversation: increment unread, reset 24h window
    conversation.lastMessage = message.messageContent;
    conversation.lastMessageAt = receivedAt;
    conversation.lastInboundMessageAt = receivedAt;
    conversation.lastMessageDirection = "INBOUND";
    conversation.lastMessageStatus = "READ";
    conversation.status = "OPEN";
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    await conversation.save();

    emitWhatsAppMessage({ conversation, message });
    emitWhatsAppConversation(conversation);

    return { message, conversation };
  }

  /**
   * Update message delivery status from Meta status webhook.
   */
  static async updateMessageStatus(params: {
    whatsappMessageId: string;
    status: string; // 'sent' | 'delivered' | 'read' | 'failed'
    timestamp?: number;
    errorDetails?: string;
    isDemo?: boolean;
  }): Promise<IWhatsappMessage | null> {
    const isDemo = Boolean(params.isDemo);
    const MessageModel = getWhatsappMessageModel(isDemo);

    const message = await MessageModel.findOne({ whatsappMessageId: params.whatsappMessageId });
    if (!message) return null;

    const time = params.timestamp ? new Date(params.timestamp * 1000) : new Date();
    const normalizedStatus = params.status.toUpperCase() as WhatsappDeliveryStatus;

    // Status progression: SENDING -> SENT -> DELIVERED -> READ. Failed is terminal.
    const ranks: Record<WhatsappDeliveryStatus, number> = {
      SENDING: 0,
      SENT: 1,
      DELIVERED: 2,
      READ: 3,
      FAILED: 4,
    };

    if (normalizedStatus === "FAILED") {
      message.deliveryStatus = "FAILED";
      if (params.errorDetails) message.errorDetails = params.errorDetails;
    } else if (ranks[normalizedStatus] > ranks[message.deliveryStatus]) {
      message.deliveryStatus = normalizedStatus;
      if (normalizedStatus === "DELIVERED") message.deliveredAt = time;
      if (normalizedStatus === "READ") {
        message.readAt = time;
        if (!message.deliveredAt) message.deliveredAt = time;
      }
    }

    await message.save();

    // Also update parent conversation's lastMessageStatus if this was the last message
    const ConvModel = getWhatsappConversationModel(isDemo);
    const conv = await ConvModel.findById(message.conversationId);
    if (conv) {
      conv.lastMessageStatus = message.deliveryStatus;
      await conv.save();
    }

    emitWhatsAppStatus({
      messageId: message.whatsappMessageId || String(message._id),
      status: message.deliveryStatus,
      timestamp: time,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      conversationId: String(message.conversationId),
      errorDetails: message.errorDetails || undefined,
    });

    return message;
  }

  /**
   * List conversations with search, filtering and pagination.
   */
  static async listConversations(query: {
    status?: "OPEN" | "CLOSED";
    filter?: "all" | "unread" | "open" | "closed";
    search?: string;
    page?: number;
    limit?: number;
    isDemo?: boolean;
  }) {
    const isDemo = Boolean(query.isDemo);
    const ConvModel = getWhatsappConversationModel(isDemo);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 30));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.filter === "unread") {
      filter.unreadCount = { $gt: 0 };
    } else if (query.filter === "open" || query.status === "OPEN") {
      filter.status = "OPEN";
    } else if (query.filter === "closed" || query.status === "CLOSED") {
      filter.status = "CLOSED";
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ customerName: re }, { phoneNumber: re }, { lastMessage: re }];
    }

    const [conversations, totalCount, unreadCount] = await Promise.all([
      ConvModel.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit),
      ConvModel.countDocuments(filter),
      ConvModel.countDocuments({ unreadCount: { $gt: 0 } }),
    ]);

    const enriched = conversations.map((c) => {
      const obj = c.toObject();
      const windowInfo = this.check24HourWindow(c);
      return {
        ...obj,
        window: windowInfo,
      };
    });

    return {
      conversations: enriched,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalConversations: await ConvModel.countDocuments(),
        unreadConversations: unreadCount,
      },
    };
  }

  /**
   * Get single conversation details with customer context and 24h window.
   */
  static async getConversation(conversationId: string, isDemo = false) {
    const ConvModel = getWhatsappConversationModel(isDemo);
    const conv = await ConvModel.findById(conversationId);
    if (!conv) throw httpError(404, "Conversation not found.", "NOT_FOUND");

    const windowInfo = this.check24HourWindow(conv);
    const context = await this.getCustomerContext(conv.phoneNumber, isDemo);

    return {
      conversation: conv,
      window: windowInfo,
      customerContext: context,
    };
  }

  /**
   * List messages in a conversation.
   */
  static async listMessages(
    conversationId: string,
    opts: { limit?: number; before?: string; isDemo?: boolean } = {}
  ) {
    const isDemo = Boolean(opts.isDemo);
    const MessageModel = getWhatsappMessageModel(isDemo);
    const limit = Math.max(1, Math.min(200, Number(opts.limit) || 100));

    const filter: Record<string, any> = { conversationId };
    if (opts.before) {
      filter.createdAt = { $lt: new Date(opts.before) };
    }

    const messages = await MessageModel.find(filter).sort({ createdAt: 1 }).limit(limit);

    return messages;
  }

  /**
   * Send a manual custom message to customer.
   * Enforces 24-hour customer service window on the backend.
   */
  static async sendManualMessage(params: {
    conversationId: string;
    text: string;
    mediaUrl?: string;
    mediaType?: WhatsappMessageType;
    adminId?: any;
    isDemo?: boolean;
  }) {
    const isDemo = Boolean(params.isDemo);
    const ConvModel = getWhatsappConversationModel(isDemo);
    const conv = await ConvModel.findById(params.conversationId);
    if (!conv) throw httpError(404, "Conversation not found.", "NOT_FOUND");

    // Enforce 24-hour customer messaging window!
    const windowInfo = this.check24HourWindow(conv);
    if (!windowInfo.isOpen) {
      throw httpError(
        400,
        "The 24-hour customer service window has expired. Meta policy requires an approved WhatsApp template to initiate or continue conversations.",
        "WINDOW_EXPIRED"
      );
    }

    const text = params.text.trim();
    if (!text && !params.mediaUrl) {
      throw httpError(400, "Message text or media is required.", "INVALID_INPUT");
    }

    let dispatchedMessageId: string | undefined;
    let dispatchError: string | undefined;

    // Outbound Cloud API call via whatsapp.service
    const dispatchResult = await sendWhatsApp(
      isDemo,
      {
        event: "INBOX_REPLY",
        to: conv.phoneNumber,
        params: [],
        text,
        isFreeformText: true,
      },
      "en",
      undefined,
      {
        skipRecord: true,
        onResult: (res) => {
          if (res.messageId) dispatchedMessageId = res.messageId;
          if (res.error) dispatchError = res.error;
        },
      }
    );

    const deliveryStatus: WhatsappDeliveryStatus = dispatchResult === "FAILED" ? "FAILED" : "SENT";

    const savedMsg = await this.recordOutboundMessage({
      to: conv.phoneNumber,
      text,
      whatsappMessageId: dispatchedMessageId,
      senderType: "ADMIN",
      messageType: params.mediaUrl ? (params.mediaType || "IMAGE") : "TEXT",
      mediaUrl: params.mediaUrl,
      deliveryStatus,
      errorDetails: dispatchError,
      adminId: params.adminId,
      customerName: conv.customerName,
      isDemo,
    });

    return savedMsg;
  }

  /**
   * Send an approved WhatsApp Template message.
   * Allowed at any time, even outside the 24-hour window!
   */
  static async sendTemplateMessage(params: {
    conversationId: string;
    templateId: string;
    params: string[];
    language?: string;
    adminId?: any;
    isDemo?: boolean;
  }) {
    const isDemo = Boolean(params.isDemo);
    const ConvModel = getWhatsappConversationModel(isDemo);
    const conv = await ConvModel.findById(params.conversationId);
    if (!conv) throw httpError(404, "Conversation not found.", "NOT_FOUND");

    const templateDef = APPROVED_TEMPLATES.find(
      (t) => t.id === params.templateId || t.name === params.templateId || t.event === params.templateId
    );
    if (!templateDef) {
      throw httpError(400, `Unknown WhatsApp template: ${params.templateId}`, "UNKNOWN_TEMPLATE");
    }

    const filledParams = params.params || [];
    const renderedText = templateDef.formatText(filledParams);

    let dispatchedMessageId: string | undefined;
    let dispatchError: string | undefined;

    // Call Cloud API with template
    const dispatchResult = await sendWhatsApp(
      isDemo,
      {
        event: templateDef.event,
        to: conv.phoneNumber,
        params: filledParams,
        text: renderedText,
      },
      params.language || templateDef.language,
      templateDef.name,
      {
        skipRecord: true,
        onResult: (res) => {
          if (res.messageId) dispatchedMessageId = res.messageId;
          if (res.error) dispatchError = res.error;
        },
      }
    );

    const deliveryStatus: WhatsappDeliveryStatus = dispatchResult === "FAILED" ? "FAILED" : "SENT";

    const savedMsg = await this.recordOutboundMessage({
      to: conv.phoneNumber,
      text: renderedText,
      whatsappMessageId: dispatchedMessageId,
      senderType: "ADMIN",
      messageType: "TEMPLATE",
      templateName: templateDef.name,
      templateLanguage: params.language || templateDef.language,
      templateParameters: filledParams,
      deliveryStatus,
      errorDetails: dispatchError,
      adminId: params.adminId,
      customerName: conv.customerName,
      isDemo,
    });

    return savedMsg;
  }

  /**
   * Mark a conversation as read (resets unreadCount to 0).
   */
  static async markConversationRead(conversationId: string, isDemo = false) {
    const ConvModel = getWhatsappConversationModel(isDemo);
    const conv = await ConvModel.findByIdAndUpdate(
      conversationId,
      { $set: { unreadCount: 0 } },
      { new: true }
    );
    if (conv) emitWhatsAppConversation(conv);
    return conv;
  }

  /**
   * Update conversation status (OPEN / CLOSED).
   */
  static async updateConversationStatus(
    conversationId: string,
    status: WhatsappConversationStatus,
    isDemo = false
  ) {
    const ConvModel = getWhatsappConversationModel(isDemo);
    const conv = await ConvModel.findByIdAndUpdate(
      conversationId,
      { $set: { status } },
      { new: true }
    );
    if (conv) emitWhatsAppConversation(conv);
    return conv;
  }

  /**
   * Return all approved WhatsApp templates available for admin selection.
   */
  static getApprovedTemplates() {
    return APPROVED_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      event: t.event,
      title: t.title,
      category: t.category,
      language: t.language,
      description: t.description,
      variables: t.variables,
      samplePreview: t.formatText(t.variables.map((v) => v.sample)),
    }));
  }
}
