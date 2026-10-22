import { Router } from "express";
import crypto from "crypto";
import { CloudinaryService } from "../services/cloudinary.service.js";
import { httpError } from "../middlewares/error-handler.js";

const router = Router();

/**
 * Signed direct upload (mounted behind the StayRide session check). The app uploads the photo
 * straight to Cloudinary, so the image never passes through this API (Vercel caps request bodies
 * at 4.5 MB); the app then saves the returned https URL on the homestay (PUT /homestay → MongoDB).
 * Owners only, never the shared demo account; each homestay gets its own folder, named by a hash
 * so the owner's email never appears in a public image URL.
 */
router.get("/signature", (req, res) => {
  const user = (req as any).stayrideUser;
  if (user?.role !== "owner") throw httpError(403, "Only homestay owners can upload photos.");
  if (user.isDemo) throw httpError(403, "Photo uploads are turned off for the demo account.");
  if (!CloudinaryService.isConfigured()) throw httpError(503, "Photo uploads are not set up yet. Please try again later.");
  const folder = `stayride/homestays/${crypto.createHash("sha256").update(String(user.tenantKey)).digest("hex").slice(0, 16)}`;
  res.json({ success: true, ...CloudinaryService.getDirectUploadSignature(folder) });
});

export default router;
