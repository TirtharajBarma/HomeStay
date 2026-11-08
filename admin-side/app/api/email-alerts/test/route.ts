import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "RESEND_API_KEY is not configured in server environment variables." },
        { status: 500 }
      );
    }

    const defaultFrom = process.env.SMTP_FROM || "StayCabs Bookings <booking@send.staycabs.in>";
    const replyTo = process.env.SUPPORT_EMAIL || "support@staycabs.in";
    const body = await req.json().catch(() => ({}));
    const rawRecipients: unknown[] = Array.isArray(body?.recipients)
      ? body.recipients
      : typeof body?.recipients === "string"
      ? body.recipients.split(/[\n,]/)
      : [];

    const recipients = rawRecipients
      .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter((e) => e && e.includes("@") && e.includes("."));

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please enter at least one valid admin email address in the recipients box." },
        { status: 400 }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: defaultFrom,
        to: recipients,
        reply_to: replyTo,
        subject: "[StayCabs Ops] Test Operational Alert from StayRide Operations",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Operational Alert</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0B0F14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E6EDF3;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #121820; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 20px 24px; background-color: #0D1117; border-bottom: 1px solid #1E293B;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size: 16px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">StayCabs Operations</span>
              <span style="display: block; font-size: 11px; color: #94A3B8; margin-top: 2px;">Live Himalayan Travel &amp; Transit Network</span>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; background-color: rgba(46, 160, 67, 0.15); color: #3FB950; border: 1px solid rgba(46, 160, 67, 0.3);">
                TEST ALERT
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #FFFFFF;">
          Test Operational Alert
        </h2>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #94A3B8; line-height: 1.5;">
          This is a real-time verification email dispatched from your StayRide Platform Settings. Your admin email alerts are working!
        </p>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0D1117; border: 1px solid #1E293B; border-radius: 8px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 10px 16px; font-size: 12px; color: #94A3B8; border-bottom: 1px solid #1E293B; width: 38%;">Dispatch Timestamp</td>
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #FFFFFF; font-family: monospace; border-bottom: 1px solid #1E293B;">${new Date().toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; font-size: 12px; color: #94A3B8; border-bottom: 1px solid #1E293B;">Mail Engine</td>
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #FFFFFF; font-family: monospace; border-bottom: 1px solid #1E293B;">Resend Transactional API</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; font-size: 12px; color: #94A3B8;">Verified Sender</td>
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #FFFFFF; font-family: monospace;">bookings@send.staycabs.in</td>
          </tr>
        </table>
        <div style="text-align: center; margin-top: 10px;">
          <a href="https://admin.staycabs.in" style="display: inline-block; background-color: #1E7E4B; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
            Open Operations Desk &rarr;
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px; background-color: #0D1117; border-top: 1px solid #1E293B; text-align: center; font-size: 11px; color: #64748B;">
        Dispatched exclusively to authorized platform administrators (${recipients.join(", ")}).
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: data?.message || "Resend API error" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      recipients,
      id: data?.id,
      message: `Test operational alert sent to ${recipients.join(", ")}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
