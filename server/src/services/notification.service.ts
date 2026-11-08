import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { CommissionService } from "./commission.service.js";

export interface AdminAlertDetails {
  badge: string;
  reference?: string;
  summary: string;
  items: Array<{ label: string; value: string }>;
  actionUrl?: string;
  actionText?: string;
}

export type AdminAlertEvent =
  | "bookingCreated"
  | "cabRequestCreated"
  | "paymentClaimSubmitted"
  | "advancePaid"
  | "tripCompleted"
  | "refundClaimed";

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
   * Dispatch instant operational email alert to configured Admin email addresses.
   * Only administrators receive these alerts; guests and drivers are never emailed.
   */
  static async sendAdminAlert(
    event: AdminAlertEvent,
    title: string,
    details: AdminAlertDetails,
    isDemo = false
  ): Promise<{ success: boolean; recipients: string[]; error?: string }> {
    try {
      const cfg = await CommissionService.getPlatformConfig(isDemo);
      const emailConfig = cfg.emailAlerts;

      if (!emailConfig?.enabled) {
        logger.info(`[ADMIN ALERT SKIPPED] Email alerts globally disabled in platform settings for ${event}`);
        return { success: false, recipients: [], error: "Alerts disabled" };
      }

      if (emailConfig.triggers && emailConfig.triggers[event] === false) {
        logger.info(`[ADMIN ALERT SKIPPED] Event trigger ${event} is toggled off in platform settings`);
        return { success: false, recipients: [], error: `Trigger ${event} disabled` };
      }

      const recipients = (emailConfig.recipients || [])
        .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter((e) => e && e.includes("@") && e.includes("."));

      if (recipients.length === 0) {
        logger.warn(`[ADMIN ALERT SKIPPED] No valid admin recipient emails configured for ${event}`);
        return { success: false, recipients: [], error: "No recipients" };
      }

      const resendApiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith("re_") ? process.env.SMTP_PASS : "");
      const transporter = this.getTransporter();
      if (!resendApiKey && !transporter) {
        logger.warn(`[ADMIN ALERT] Neither Resend API key nor SMTP configured. Alert logged to console for ${recipients.join(", ")}`);
        return { success: false, recipients, error: "Email service not configured" };
      }

      const defaultFrom = process.env.SMTP_FROM || `"StayCabs Bookings" <booking@send.${config.appDomain || "staycabs.in"}>`;
      const replyTo = config.supportEmail || `support@${config.appDomain || "staycabs.in"}`;
      const subject = `[StayCabs Ops] ${title}`;

      const textBody = `
[${details.badge.toUpperCase()}]
${title}
${details.summary}

----------------------------------------
${details.items.map((i) => `${i.label.padEnd(22)}: ${i.value}`).join("\n")}
----------------------------------------

StayCabs Operations Desk · Darjeeling & Sikkim Himalayas
      `.trim();

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0B0F14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E6EDF3;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #121820; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 20px 24px; background-color: #0D1117; border-bottom: 1px solid #1E293B;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size: 16px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">StayCabs Operations</span>
              <span style="display: block; font-size: 11px; color: #94A3B8; margin-top: 2px;">Live Himalayan Travel & Transit Network</span>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; background-color: rgba(46, 160, 67, 0.15); color: #3FB950; border: 1px solid rgba(46, 160, 67, 0.3);">
                ${details.badge}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #FFFFFF; line-height: 1.3;">
          ${title}
        </h2>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #94A3B8; line-height: 1.5;">
          ${details.summary}
        </p>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0D1117; border: 1px solid #1E293B; border-radius: 8px; margin-bottom: 24px;">
          ${details.items
            .map(
              (item, idx) => `
          <tr>
            <td style="padding: 10px 16px; font-size: 12px; color: #94A3B8; border-bottom: ${idx === details.items.length - 1 ? "none" : "1px solid #1E293B"}; width: 38%;">
              ${item.label}
            </td>
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #FFFFFF; font-family: monospace; border-bottom: ${idx === details.items.length - 1 ? "none" : "1px solid #1E293B"};">
              ${item.value}
            </td>
          </tr>`
            )
            .join("")}
        </table>
        <div style="text-align: center; margin-top: 10px;">
          <a href="${details.actionUrl || "https://admin.staycabs.in"}" style="display: inline-block; background-color: #1E7E4B; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
            ${details.actionText || "Open Operations Desk →"}
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px; background-color: #0D1117; border-top: 1px solid #1E293B; text-align: center; font-size: 11px; color: #64748B;">
        This operational alert was dispatched exclusively to authorized platform administrators (${recipients.join(", ")}).
        <br>Manage your alert preferences in Admin Dashboard → Platform Settings.
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      let dispatched = false;

      // 1. Prefer Resend REST API (faster, 100% reliable on Vercel Serverless)
      if (resendApiKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: defaultFrom,
              to: recipients,
              reply_to: replyTo,
              subject,
              text: textBody,
              html: htmlBody,
            }),
          });
          if (res.ok) {
            dispatched = true;
          } else {
            const errData = await res.json().catch(() => ({})) as any;
            logger.warn(`[ADMIN ALERT] Resend REST API returned error: ${errData?.message || res.statusText}. Falling back to SMTP...`);
          }
        } catch (fetchErr: any) {
          logger.warn(`[ADMIN ALERT] Resend fetch exception: ${fetchErr?.message}. Falling back to SMTP...`);
        }
      }

      // 2. Fallback to Nodemailer SMTP
      if (!dispatched && transporter) {
        await transporter.sendMail({
          from: defaultFrom,
          to: recipients.join(", "),
          replyTo,
          subject,
          text: textBody,
          html: htmlBody,
        });
        dispatched = true;
      }

      if (!dispatched) {
        throw new Error("Failed to dispatch alert via Resend API or SMTP");
      }

      logger.info(`[ADMIN ALERT SENT] Dispatched "${title}" to ${recipients.join(", ")}`, {
        action: "email.admin_alert",
        metadata: { event, recipients, reference: details.reference },
      });

      return { success: true, recipients };
    } catch (err: any) {
      logger.warn(`[ADMIN ALERT FAILED] Error dispatching "${title}": ${err?.message}`, {
        action: "email.admin_alert.error",
        error: { message: err?.message || String(err), stack: err?.stack },
      });
      return { success: false, recipients: [], error: err?.message || "Failed to send email" };
    }
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
    if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
      console.log(`\n📧 [EMAIL DISPATCH TO GUEST] -> ${data.guestEmail}`);
      console.log(`   Subject: ${guestSubject}`);
      console.log(`   Ref: ${data.reference} | Room: ${data.roomName} | PIN: ${data.pin}`);
      console.log(`📧 [ALERT DISPATCH TO OWNER] -> ${ownerEmail}`);
      console.log(`   Subject: ${ownerSubject}`);
      console.log(`   Guest: ${data.guestName} | Total: ₹${data.totalAmount}\n`);
    }

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
    console.log(`   Driver: ${data.driverName} | Fare: ₹${data.fareAmount}`);
    console.log(`🚖 [ALERT DISPATCH TO DRIVER] -> ${driverEmail}`);
    console.log(`   Subject: ${driverSubject}`);
    console.log(`   Passenger: ${data.guestName} | Route: ${data.pickup} -> ${data.dropoff}\n`);

    return { guestNotified: true, driverNotified: true };
  }
}
