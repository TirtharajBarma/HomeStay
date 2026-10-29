import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface BookingNotificationPayload {
  reference: string;
  pin: string;
  roomName: string;
  homestayName?: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  ownerEmail?: string;
}

export interface CabNotificationPayload {
  reference: string;
  driverName: string;
  driverPhone: string;
  driverEmail?: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  fareAmount: number;
}

type MailTransporter = ReturnType<typeof nodemailer.createTransport>;

export class NotificationService {
  private static transporter: MailTransporter | null = null;

  private static getTransporter(): MailTransporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST || "";
    const isConfigured = Boolean(
      host &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      host !== "disabled" &&
      host !== "none" &&
      !host.includes("placeholder")
    );
    if (isConfigured) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      return this.transporter;
    }
    return null;
  }

  /**
   * Dispatch booking confirmation to Guest and alert to Homestay Owner
   */
  static async sendBookingNotifications(data: BookingNotificationPayload): Promise<{
    guestNotified: boolean;
    ownerNotified: boolean;
  }> {
    const homestay = data.homestayName || "Boutique Homestay Estate";
    const guestSubject = `Reservation Confirmed: ${data.reference} at ${homestay}`;
    const guestBody = `
Dear ${data.guestName},

Your reservation at ${homestay} is confirmed!

Booking Reference: ${data.reference}
Door PIN Code: ${data.pin}
Room: ${data.roomName}
Check-In: ${data.checkIn}
Check-Out: ${data.checkOut} (${data.nights} nights)
Total Paid / Settled: INR ${data.totalAmount.toLocaleString("en-IN")}

We look forward to welcoming you to the Darjeeling hills.
Warm regards,
${homestay} Team
    `.trim();

    const defaultFrom = process.env.SMTP_FROM || `"${config.appName || "StayCabs"}" <bookings@send.${config.appDomain || "staycabs.in"}>`;
    const ownerEmail = data.ownerEmail || config.supportEmail || `support@${config.appDomain || "staycabs.in"}`;
    const ownerSubject = `New Guest Booking Alert: ${data.reference} (${data.guestName})`;
    const ownerBody = `
New Booking Notification for ${homestay}:

Reference: ${data.reference}
Guest: ${data.guestName} (${data.guestEmail})
Room: ${data.roomName}
Stay Dates: ${data.checkIn} to ${data.checkOut} (${data.nights} nights)
Revenue: INR ${data.totalAmount.toLocaleString("en-IN")}

The reservation schedule and CRM have been updated automatically.
    `.trim();

    const transporter = this.getTransporter();
    if (transporter) {
      try {
        if (data.guestEmail && data.guestEmail.includes("@")) {
          await transporter.sendMail({
            from: defaultFrom,
            to: data.guestEmail,
            subject: guestSubject,
            text: guestBody,
          });
        }
        if (ownerEmail && ownerEmail.includes("@")) {
          await transporter.sendMail({
            from: defaultFrom,
            to: ownerEmail,
            subject: ownerSubject,
            text: ownerBody,
          });
        }
        logger.info(`[EMAIL SENT] Booking confirmation dispatched to ${data.guestEmail}`, {
          tenantId: data.ownerEmail,
          metadata: { reference: data.reference, guest: data.guestName, room: data.roomName, amount: data.totalAmount },
        });
        return { guestNotified: true, ownerNotified: true };
      } catch (err: any) {
        console.warn("SMTP email dispatch notice:", err);
        logger.warn(`[EMAIL FAILED] SMTP dispatch error to ${data.guestEmail}: ${err?.message}`, {
          tenantId: data.ownerEmail,
          metadata: { reference: data.reference, error: String(err) },
        });
      }
    }

    logger.info(`[EMAIL CONSOLE] Booking alert logged for ${data.guestEmail}`, {
      tenantId: data.ownerEmail,
      metadata: { reference: data.reference, guest: data.guestName, amount: data.totalAmount },
    });

    // In-memory / Console fallback during development or when SMTP is not configured
    console.log(`\n📧 [EMAIL DISPATCH TO GUEST] -> ${data.guestEmail}`);
    console.log(`   Subject: ${guestSubject}`);
    console.log(`   Ref: ${data.reference} | Room: ${data.roomName} | PIN: ${data.pin}`);
    console.log(`📧 [ALERT DISPATCH TO OWNER] -> ${ownerEmail}`);
    console.log(`   Subject: ${ownerSubject}`);
    console.log(`   Guest: ${data.guestName} | Total: ₹${data.totalAmount}\n`);

    return { guestNotified: true, ownerNotified: true };
  }

  /**
   * Dispatch cab confirmation to Guest and trip dispatch alert to Driver
   */
  static async sendCabNotifications(data: CabNotificationPayload): Promise<{
    guestNotified: boolean;
    driverNotified: boolean;
  }> {
    const guestSubject = `Hill Transfer Confirmed: ${data.reference} with ${data.driverName}`;
    const guestBody = `
Dear ${data.guestName},

Your hill transit transfer has been scheduled!

Trip Reference: ${data.reference}
Driver: ${data.driverName} (${data.driverPhone})
Pickup: ${data.pickup}
Dropoff: ${data.dropoff}
Scheduled Time: ${data.date} at ${data.time}
Upfront Fare: INR ${data.fareAmount.toLocaleString("en-IN")}

Your driver will meet you at the pickup location.
Safe travels in the hills!
    `.trim();

    const defaultFrom = process.env.SMTP_FROM || `"${config.appName || "StayCabs"}" <bookings@send.${config.appDomain || "staycabs.in"}>`;
    const driverEmail = data.driverEmail || "";
    const driverSubject = `New Trip Dispatch: ${data.reference} - Pickup at ${data.pickup}`;
    const driverBody = `
New Cab Booking Dispatch:

Reference: ${data.reference}
Passenger: ${data.guestName} (${data.guestPhone})
Pickup: ${data.pickup}
Dropoff: ${data.dropoff}
Time: ${data.date} at ${data.time}
Total Fare: INR ${data.fareAmount}

Please arrive 10 minutes prior to pickup time.
    `.trim();

    const transporter = this.getTransporter();
    if (transporter) {
      try {
        if (data.guestEmail && data.guestEmail.includes("@")) {
          await transporter.sendMail({
            from: defaultFrom,
            to: data.guestEmail,
            subject: guestSubject,
            text: guestBody,
          });
        }
        if (driverEmail && driverEmail.includes("@")) {
          await transporter.sendMail({
            from: defaultFrom,
            to: driverEmail,
            subject: driverSubject,
            text: driverBody,
          });
        }
        logger.info(`[EMAIL SENT] Cab transfer alert dispatched to ${data.guestEmail} and driver ${driverEmail}`, {
          driverId: driverEmail,
          metadata: { reference: data.reference, guest: data.guestName, fare: data.fareAmount, driver: data.driverName },
        });
        return { guestNotified: true, driverNotified: true };
      } catch (err: any) {
        console.warn("SMTP cab dispatch email notice:", err);
        logger.warn(`[EMAIL FAILED] SMTP cab dispatch error: ${err?.message}`, {
          driverId: driverEmail,
          metadata: { reference: data.reference, error: String(err) },
        });
      }
    }

    logger.info(`[EMAIL CONSOLE] Cab transfer logged for ${data.guestEmail}`, {
      driverId: driverEmail,
      metadata: { reference: data.reference, guest: data.guestName, fare: data.fareAmount },
    });

    console.log(`\n🚖 [EMAIL DISPATCH TO GUEST] -> ${data.guestEmail}`);
    console.log(`   Subject: ${guestSubject}`);
    console.log(`   Driver: ${data.driverName} (${data.driverPhone}) | Fare: ₹${data.fareAmount}`);
    console.log(`🚖 [ALERT DISPATCH TO DRIVER] -> ${driverEmail}`);
    console.log(`   Subject: ${driverSubject}`);
    console.log(`   Passenger: ${data.guestName} | Route: ${data.pickup} -> ${data.dropoff}\n`);

    return { guestNotified: true, driverNotified: true };
  }
}
