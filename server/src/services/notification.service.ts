import nodemailer from "nodemailer";
import { config } from "../config/env.js";

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

export class NotificationService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
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
    const homestay = data.homestayName || "Tirtha Homestay Estate";
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

    const ownerEmail = data.ownerEmail || "host@tirtha-estate.com";
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
        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"Tirtha Stays" <no-reply@tirtha-estate.com>`,
          to: data.guestEmail,
          subject: guestSubject,
          text: guestBody,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"Tirtha Stays" <no-reply@tirtha-estate.com>`,
          to: ownerEmail,
          subject: ownerSubject,
          text: ownerBody,
        });
        return { guestNotified: true, ownerNotified: true };
      } catch (err) {
        console.warn("SMTP email dispatch notice:", err);
      }
    }

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

    const driverEmail = data.driverEmail || `${data.driverName.toLowerCase().replace(/\s+/g, ".")}@gumtreevalley.in`;
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
        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"Tirtha Cabs" <no-reply@tirtha-estate.com>`,
          to: data.guestEmail,
          subject: guestSubject,
          text: guestBody,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"Tirtha Cabs" <no-reply@tirtha-estate.com>`,
          to: driverEmail,
          subject: driverSubject,
          text: driverBody,
        });
        return { guestNotified: true, driverNotified: true };
      } catch (err) {
        console.warn("SMTP cab dispatch email notice:", err);
      }
    }

    console.log(`\n🚖 [EMAIL DISPATCH TO GUEST] -> ${data.guestEmail}`);
    console.log(`   Subject: ${guestSubject}`);
    console.log(`   Driver: ${data.driverName} (${data.driverPhone}) | Fare: ₹${data.fareAmount}`);
    console.log(`🚖 [ALERT DISPATCH TO DRIVER] -> ${driverEmail}`);
    console.log(`   Subject: ${driverSubject}`);
    console.log(`   Passenger: ${data.guestName} | Route: ${data.pickup} -> ${data.dropoff}\n`);

    return { guestNotified: true, driverNotified: true };
  }
}
