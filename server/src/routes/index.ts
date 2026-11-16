import { Router } from "express";
import propertyRoutes from "./property.routes.js";
import roomRoutes from "./room.routes.js";
import bookingRoutes from "./booking.routes.js";
import guestRoutes from "./guest.routes.js";
import driverRoutes from "./driver.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import uploadRoutes from "./upload.routes.js";
import telemetryRoutes from "./telemetry.routes.js";
import { IcalController } from "../controllers/ical.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { Newsletter } from "../models/newsletter.model.js";
import { HomestayLead } from "../models/homestay-lead.model.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";
import { requireRecaptcha } from "../middlewares/recaptcha.js";

const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Hill Hospitality & Transit Network API v1",
    version: "1.0.0",
    docs: "/api/v1",
  });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/upload", uploadRoutes);
apiRouter.use("/telemetry", telemetryRoutes);


// Guest-website marketplace APIs: public listings, rooms, stays, bookings & transit
apiRouter.use("/properties", propertyRoutes);
apiRouter.use("/rooms", roomRoutes);
apiRouter.use("/stays", roomRoutes); // Alias for client-side
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/reservations", bookingRoutes); // Alias for client-side
apiRouter.use("/guests", guestRoutes);
apiRouter.use("/drivers", driverRoutes);
apiRouter.use("/cabs", driverRoutes); // Alias for client-side
apiRouter.use("/analytics", analyticsRoutes);
apiRouter.get("/ical/export/:codeOrSlug", IcalController.exportIcal);

// Inbound sync mutates bookings and makes the server fetch an attacker-supplied URL, so it must be
// an authenticated owner/admin action (matches POST /rooms/:codeOrSlug/sync-ical).
apiRouter.post("/ical/sync/:codeOrSlug", verifyToken, requireRole("owner", "admin"), IcalController.syncInboundIcal);

// Newsletter subscription endpoint
apiRouter.post("/newsletter/subscribe", requireRecaptcha("newsletter_subscribe"), async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }
  try {
    await Newsletter.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { email: email.toLowerCase().trim() }, $setOnInsert: { source: "website" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: "Subscribed to StayCabs hill route and platform updates successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to subscribe" });
  }
});

// Homestay Owner Quick Registration / Lead Generation
apiRouter.post("/homestay-leads", async (req, res) => {
  const { name, phone, location, rooms } = req.body || {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: "Please enter your homestay name (at least 2 characters)." });
  }

  const cleanPhone = typeof phone === "string" ? phone.replace(/\D/g, "").slice(-10) : "";
  if (!cleanPhone || cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: "Please enter a valid 10-digit WhatsApp phone number." });
  }

  const cleanLocation = typeof location === "string" && location.trim() ? location.trim() : "Darjeeling";
  const numRooms = typeof rooms === "number" ? rooms : (parseInt(rooms, 10) || 3);

  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const lead = await HomestayLead.findOneAndUpdate(
      { phone: cleanPhone },
      {
        name: name.trim(),
        phone: cleanPhone,
        location: cleanLocation,
        rooms: Math.max(1, Math.min(100, numRooms)),
        ip,
        source: "landing_page_quick_register",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`[Homestay Lead] New host registration: "${name.trim()}" (${cleanLocation}) - Phone: ••••${cleanPhone.slice(-4)}`);

    return res.status(201).json({
      success: true,
      message: "Homestay profile registered successfully! Our hill operations team will reach out via WhatsApp.",
      lead: {
        id: lead._id,
        name: lead.name,
        location: lead.location,
        rooms: lead.rooms,
      },
    });
  } catch (err: any) {
    logger.error("[Homestay Lead Error]", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to register homestay lead" });
  }
});

export default apiRouter;
