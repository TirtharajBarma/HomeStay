// Legal pages shown in the app (and on the public web): Privacy Policy, Terms of Service, Refund &
// Cancellation Policy. Served by the server so they can change without an app release. Business
// details come from the admin's settings; anything not filled in shows a visible placeholder, never
// an invented fact. The text describes what the app actually does; update it when behaviour changes.
// NOTE: this is a starting template, not legal advice. Have it reviewed before publishing.
import { BusinessDetails } from '../services/platform-config.js';

export const LEGAL_VERSION = '2026-10-19';
export const LEGAL_DOCS = ['privacy', 'terms', 'refunds'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

export interface LegalSection {
  heading: string;
  body: string;
}

const fill = (v: string, label: string) => v || `[${label}: to be added by StayRide]`;

function contact(b: BusinessDetails) {
  return [
    `${fill(b.legalName, 'registered business name')} (${b.name || 'StayRide'})`,
    `Address: ${fill(b.address, 'registered address')}`,
    `Email: ${fill(b.email, 'support email')}${b.phone ? ` · Phone: ${b.phone}` : ''}`,
    b.website ? `Website: ${b.website}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function privacy(b: BusinessDetails): LegalSection[] {
  const brand = b.name || 'StayRide';
  return [
    { heading: 'Who we are', body: `${brand} helps homestay owners manage rooms and guests, and helps local cab drivers get trips from homestays near them. This policy applies to both homestay owners and drivers, and explains what personal data the ${brand} app collects and how it is used.\n\n${contact(b)}` },
    {
      heading: 'What we collect',
      body:
        '• Homestay owners: name, email, phone, homestay name, address and map location, and the guest, room, booking and payment records you add.\n' +
        '• Drivers: name, email, phone, vehicle details, operating area, ratings, and your location while you are online with the app open.\n' +
        '• Guests (added by a homestay or through a cab-request link): name, phone number, stay dates, trip details and payments.\n' +
        '• Device data: a push-notification token and app version, so we can send you trip updates.\n' +
        'We only ask for what is needed to run bookings and cab trips.',
    },
    {
      heading: 'Why we use it',
      body:
        'To create and manage bookings and cab trips, match requests with drivers near the homestay, process advances, commissions and payouts, send trip updates by push notification or WhatsApp, provide support, prevent fraud and meet legal obligations. Marketing messages are sent to guests only if they agreed to receive them.',
    },
    {
      heading: 'Who we share it with',
      body:
        '• Between users, only when needed: a driver and guest receive each other’s phone number and trip details only after the advance is paid. A homestay sees its own guests only.\n' +
        `• Service providers that run ${brand} on our behalf: Clerk (sign-in), Google (Google sign-in and maps on Android), Apple (maps on iPhone), Meta (WhatsApp Business messages), Razorpay (payments; we never see or store your card or UPI credentials), Expo (app updates and notifications), MongoDB Atlas (database) and Vercel (servers).\n` +
        '• Authorities, when the law requires it.\n' +
        'We do not sell personal data or use it for third-party advertising. The app does not use advertising cookies or trackers.',
    },
    {
      heading: 'Location',
      body:
        'Drivers: while you are online with the app open, your location is used to offer you nearby trip requests. It is not collected in the background. Homestays: the map pin you set is used to find drivers near you and to give drivers directions.',
    },
    {
      heading: 'How long we keep it',
      body:
        'Account data is kept while your account is active. When you delete your account, your name, phone, photo and notification tokens are erased and you can no longer sign in. Trip, payment, commission and payout records are kept for as long as Indian tax and accounting law requires (currently up to 8 years), then deleted.',
    },
    {
      heading: 'Your rights',
      body:
        'You can see and correct your details in the app, withdraw marketing consent at any time, and delete your account in the app (owners: More → Account & privacy; drivers: Profile → Account & privacy) or as explained on our Delete account page. You can also ask us for a copy of your data or raise a complaint with our Grievance Officer. We aim to respond within 30 days. If you are not satisfied, you may approach the Data Protection Board of India.\n\n' +
        `Grievance Officer: ${fill(b.grievanceOfficer, 'name')} · ${fill(b.grievanceEmail || b.email, 'grievance email')}`,
    },
    { heading: 'Children', body: `${brand} accounts are only for people aged 18 or older. Homestays should add a child’s details only when needed for a stay.` },
    { heading: 'Security', body: 'Data is sent over encrypted connections, access is limited by role, and payment details are handled only by Razorpay.' },
    { heading: 'Changes', body: `If this policy changes, we will show the updated version in the app. Version ${LEGAL_VERSION}.` },
  ];
}

function terms(b: BusinessDetails): LegalSection[] {
  const brand = b.name || 'StayRide';
  return [
    { heading: 'About these terms', body: `These terms apply when you use the ${brand} app as a homestay owner or a driver.\n\n${contact(b)}` },
    { heading: 'Who can use the app', body: 'You must be 18 or older and give true details. You are responsible for activity on your account and for keeping your sign-in secure.' },
    {
      heading: 'What we do',
      body: `${brand} is a platform. It connects homestays with independent local drivers and helps homestays manage rooms and guests. Drivers are not employees or agents of ${brand}; they set their own fares by quoting, and they are responsible for their vehicle, permits, licence and insurance.`,
    },
    {
      heading: 'Fares, advances and fees',
      body:
        'For a trip with a StayRide driver, the fare is the driver’s quote (or a counter-offer the driver accepts). The guest pays an advance to StayRide; the rest is paid in cash to the driver. The advance covers StayRide’s platform fee and the homestay’s commission. When a homestay uses its own driver, StayRide charges an own-fleet fee, paid by the guest as the advance. The amounts are shown before a trip is confirmed. There are no hidden charges.',
    },
    { heading: 'Cancellations and refunds', body: 'See the Refund & Cancellation Policy in the app.' },
    {
      heading: 'Fair use',
      body:
        'Do not arrange trips that started on StayRide outside the platform to avoid fees, share false information, harass other users, or misuse guest data. Drivers must not add phone numbers or links to quotes. We may suspend accounts that break these rules.',
    },
    {
      heading: 'Liability',
      body: `${brand} is not responsible for the conduct of drivers, guests or homestays, or for delays caused by weather, road closures or landslides. To the extent the law allows, our liability for any claim is limited to the fees we received for the trip concerned.`,
    },
    {
      heading: 'For homestay owners',
      body: 'You are responsible for the guest details you add and for having their permission to share them with a driver for their trip. Room prices, house rules and room cancellations are yours to set. Your cab commission is credited once a trip is completed and the guest’s advance is paid, and is paid out when you request it.',
    },
    {
      heading: 'For drivers',
      body: 'Driver accounts are reviewed by StayRide before you get trip requests. You must hold a valid driving licence, vehicle registration, permits and insurance, and keep your vehicle details correct. Your quote is the full fare: the guest pays StayRide an advance and pays you the balance in cash at the trip. Once you accept a trip, complete it or cancel it in the app as early as possible so the guest can be refunded and another driver found.',
    },
    { heading: 'Ending your account', body: 'You can delete your account at any time in the app: owners in More → Account & privacy, drivers in Profile → Account & privacy. We may suspend or close accounts that break these terms or the law.' },
    { heading: 'Law', body: `These terms follow the laws of India. Courts at ${fill(b.address ? b.address.split(',').slice(-2, -1)[0]?.trim() || '' : '', 'city')} have jurisdiction. Version ${LEGAL_VERSION}.` },
  ];
}

function refunds(b: BusinessDetails): LegalSection[] {
  return [
    {
      heading: 'Cab advances',
      body:
        '• Once a driver quote is confirmed and driver contact details are released, the advance payment acts as a vehicle reservation lock-in fee and is non-refundable. This protects mountain drivers who reserve their vehicles and turn down other bookings.\n' +
        '• If a trip cannot be fulfilled due to no driver accepting the broadcast, driver cancellation, vehicle breakdown, or verified road closures / landslides, the advance is refunded in full to the original payment method.\n' +
        '• If an advance is paid after a request was cancelled or expired, or paid twice in error, the excess amount is refunded in full.\n' +
        '• Eligible refunds are verified and processed within 5–7 working days via bank transfer or original payment method; banks or UPI apps may take additional time to show the credit.\n' +
        '• Once a trip has started or the driver has arrived at the pickup location, the advance is strictly non-refundable.',
    },
    {
      heading: 'For drivers',
      body: '• The advance is collected and held by StayRide; drivers do not collect or refund it directly.\n• If a driver cancels a confirmed trip, the guest’s advance is refunded in full and the trip may be re-dispatched to other drivers.\n• The cash balance is collected directly by the driver from the guest upon trip drop-off. If a trip does not occur, no cash balance is payable.',
    },
    { heading: 'Cash paid to drivers', body: 'The remaining balance is paid in cash directly to the driver at destination. StayRide does not collect this cash portion and cannot refund it directly; our support team is available to mediate any on-road disputes.' },
    { heading: 'Room bookings', body: 'Room charges are paid to the homestay, not to StayRide. Their cancellation and refund terms are set by the individual homestay.' },
    { heading: 'Questions & disputes', body: `For any booking dispute or refund enquiry, contact ${fill(b.email, 'support email')} with your trip reference number. Version ${LEGAL_VERSION}.` },
  ];
}

const TITLES: Record<LegalDoc, string> = { privacy: 'Privacy Policy', terms: 'Terms of Service', refunds: 'Refund & Cancellation Policy' };

export function legalDocument(doc: LegalDoc, business: BusinessDetails) {
  const sections = doc === 'privacy' ? privacy(business) : doc === 'terms' ? terms(business) : refunds(business);
  return { doc, title: TITLES[doc], version: LEGAL_VERSION, sections };
}
