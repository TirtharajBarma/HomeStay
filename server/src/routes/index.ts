import { Router } from "express";
import propertyRoutes from "./property.routes.js";
import roomRoutes from "./room.routes.js";
import bookingRoutes from "./booking.routes.js";
import guestRoutes from "./guest.routes.js";
import driverRoutes from "./driver.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import { Newsletter } from "../models/newsletter.model.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", adminRoutes);

apiRouter.use("/properties", propertyRoutes);
apiRouter.use("/rooms", roomRoutes);
apiRouter.use("/stays", roomRoutes); // Alias for client-side
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/reservations", bookingRoutes); // Alias for client-side
apiRouter.use("/guests", guestRoutes);
apiRouter.use("/drivers", driverRoutes);
apiRouter.use("/cabs", driverRoutes); // Alias for client-side
apiRouter.use("/analytics", analyticsRoutes);

// Newsletter subscription endpoint
apiRouter.post("/newsletter/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }
  try {
    await Newsletter.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { email: email.toLowerCase().trim() },
      { upsert: true, returnDocument: "after" }
    );
    res.json({ success: true, message: "Subscribed to seasonal estate letters successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to subscribe" });
  }
});

export default apiRouter;
