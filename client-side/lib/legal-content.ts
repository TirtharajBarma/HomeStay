export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalPageData {
  title: string;
  version: string;
  sections: LegalSection[];
}

export const FALLBACK_LEGAL_DOCS: Record<string, LegalPageData> = {
  terms: {
    title: "Terms of Service",
    version: "2026-10-19",
    sections: [
      {
        heading: "About these terms",
        body: "These terms apply when you use the StayCabs app as a homestay owner or a driver.\n\nStayCabs Mountain Travel Network\nEmail: support@staycabs.in\nWebsite: https://staycabs.in",
      },
      {
        heading: "Who can use the app",
        body: "You must be 18 or older and give true details. You are responsible for activity on your account and for keeping your sign-in secure.",
      },
      {
        heading: "What we do",
        body: "StayCabs is a platform. It connects homestays with independent local drivers and helps homestays manage rooms and guests. Drivers are not employees or agents of StayCabs; they set their own fares by quoting, and they are responsible for their vehicle, permits, licence and insurance.",
      },
      {
        heading: "Fares, advances and fees",
        body: "For a trip with a network driver, the fare is the driver’s quote (or a counter-offer the driver accepts). The guest pays an advance online; the rest is paid in cash to the driver. The advance covers the platform fee and the homestay’s commission. When a homestay uses its own driver, the platform charges an own-fleet fee, paid by the guest as the advance. The amounts are shown before a trip is confirmed. There are no hidden charges.",
      },
      {
        heading: "Cancellations and refunds",
        body: "See the Refund & Cancellation Policy in the app.",
      },
      {
        heading: "Fair use",
        body: "Do not arrange trips that started through the service outside the platform to avoid fees, share false information, harass other users, or misuse guest data. Drivers must not add phone numbers or links to quotes. We may suspend accounts that break these rules.",
      },
      {
        heading: "Liability",
        body: "StayCabs is not responsible for the conduct of drivers, guests or homestays, or for delays caused by weather, road closures or landslides. To the extent the law allows, our liability for any claim is limited to the fees we received for the trip concerned.",
      },
      {
        heading: "For homestay owners",
        body: "You are responsible for the guest details you add and for having their permission to share them with a driver for their trip. Room prices, house rules and room cancellations are yours to set. Your cab commission is credited once a trip is completed and the guest’s advance is paid, and is paid out when you request it.",
      },
      {
        heading: "For drivers",
        body: "Driver accounts are reviewed before you get trip requests. You must hold a valid driving licence, vehicle registration, permits and insurance, and keep your vehicle details correct. Your quote is the full fare: the guest pays an advance online and pays you the balance in cash at the trip. Once you accept a trip, complete it or cancel it in the app as early as possible so the guest can be refunded and another driver found.",
      },
      {
        heading: "Ending your account",
        body: "You can delete your account at any time in the app: owners in More → Account & privacy, drivers in Profile → Account & privacy. We may suspend or close accounts that break these terms or the law.",
      },
      {
        heading: "Law",
        body: "These terms follow the laws of India. Courts at Darjeeling / Jalpaiguri have jurisdiction. Version 2026-10-19.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    version: "2026-10-19",
    sections: [
      {
        heading: "Who we are",
        body: "StayCabs helps homestay owners manage rooms and guests, and helps local cab drivers get trips from homestays near them. This policy applies to both homestay owners and drivers, and explains what personal data the StayCabs app collects and how it is used.\n\nStayCabs Valley Network\nAddress: Darjeeling & Jalpaiguri, West Bengal, India\nEmail: support@staycabs.in\nWebsite: https://staycabs.in",
      },
      {
        heading: "What we collect",
        body: "• Homestay owners: name, email, phone, homestay name, address and map location, and the guest, room, booking and payment records you add.\n• Drivers: name, email, phone, vehicle details, operating area, ratings, and your location while you are online with the app open.\n• Guests: name and phone number (given by your homestay or entered when booking a cab), pickup and destination, and payment reference.\n• Device data: device model, operating system version and push notification tokens.",
      },
      {
        heading: "Why we use it",
        body: "We use this data to run the platform: matching trip requests with drivers, sending booking and payout confirmations, calculating fares and platform fees, showing homestay map pins to drivers, and providing customer support. We do not use your data to profile you or make automated decisions that have legal effects.",
      },
      {
        heading: "Who we share it with",
        body: "• Between users, only when needed: a driver and guest receive each other’s contact details and itinerary only after the reservation advance is paid. A homestay sees its own guest bookings only.\n• Essential Service Providers: We partner with regulated and certified infrastructure providers to operate the service: authorized payment aggregators (e.g. Razorpay — we never store your card or UPI credentials), verified enterprise cloud infrastructure and secure encrypted databases (SOC 2 and ISO/IEC 27001 compliant), and official communication channels (WhatsApp Business API for booking confirmations and driver dispatch).\n• Statutory Authorities: Only when strictly required by applicable Indian law or law enforcement under valid legal process.\n• We do not sell personal data, monetize user lists, or use third-party advertising cookies or trackers.",
      },
      {
        heading: "Location",
        body: "Drivers: while you are online with the app open, your location is used to offer you nearby trip requests. It is not collected in the background. Homestays: the map pin you set is used to find drivers near you and to give drivers directions.",
      },
      {
        heading: "How long we keep it",
        body: "Account data is kept while your account is active. When you delete your account, your name, phone, photo and notification tokens are erased and you can no longer sign in. Trip, payment, commission and payout records are kept for as long as Indian tax and accounting law requires (currently up to 8 years), then deleted.",
      },
      {
        heading: "Your rights",
        body: "You can see and correct your details in the app, withdraw marketing consent at any time, and delete your account in the app (owners: More → Account & privacy; drivers: Profile → Account & privacy) or as explained on our Delete account page. You can also ask us for a copy of your data or raise a complaint with our Grievance Officer.\n\nGrievance Officer: Grievance Officer · StayCabs Network · support@staycabs.in",
      },
      {
        heading: "Children",
        body: "StayCabs accounts are only for people aged 18 or older. Homestays should add a child’s details only when needed for a stay.",
      },
      {
        heading: "Security",
        body: "All data in transit is encrypted using modern cryptographic protocols (TLS 1.3 / HTTPS), and all stored data is encrypted at rest using industry-standard AES-256 encryption. Access controls are strictly role-based with multi-factor authentication for operators. Payment card numbers and UPI PINs are processed exclusively by PCI-DSS Level 1 compliant payment gateways and are never held on our servers.",
      },
      {
        heading: "Changes",
        body: "If this policy changes, we will show the updated version in the app. Version 2026-10-19.",
      },
    ],
  },
  refunds: {
    title: "Refund & Cancellation Policy",
    version: "2026-10-19",
    sections: [
      {
        heading: "Cab advances",
        body: "• Once a driver quote is confirmed and driver contact details are released, the advance payment acts as a vehicle reservation lock-in fee and is non-refundable. This protects mountain drivers who reserve their vehicles and turn down other bookings.\n• If a trip cannot be fulfilled due to no driver accepting the broadcast, driver cancellation, vehicle breakdown, or verified road closures / landslides, the advance is refunded in full to the original payment method.\n• If an advance is paid after a request was cancelled or expired, or paid twice in error, the excess amount is refunded in full.\n• Eligible refunds are verified and processed within 5–7 working days via bank transfer or original payment method; banks or UPI apps may take additional time to show the credit.\n• Once a trip has started or the driver has arrived at the pickup location, the advance is strictly non-refundable.",
      },
      {
        heading: "For drivers",
        body: "• The advance is collected and held securely; drivers do not collect or refund it directly.\n• If a driver cancels a confirmed trip, the guest’s advance is refunded in full and the trip may be re-dispatched to other drivers.\n• The cash balance is collected directly by the driver from the guest upon trip drop-off. If a trip does not occur, no cash balance is payable.",
      },
      {
        heading: "Cash paid to drivers",
        body: "The remaining balance is paid in cash directly to the driver at destination. The platform does not collect this cash portion and cannot refund it directly; our support team is available to mediate any on-road disputes.",
      },
      {
        heading: "Room bookings",
        body: "Room charges are paid to the homestay, not to the platform. Their cancellation and refund terms are set by the individual homestay.",
      },
      {
        heading: "Questions & disputes",
        body: "For any booking dispute or refund enquiry, contact support@staycabs.in with your trip reference number. Version 2026-10-19.",
      },
    ],
  },
};

export function getFallbackLegalDoc(doc: string): LegalPageData | null {
  return FALLBACK_LEGAL_DOCS[doc.toLowerCase()] || null;
}
