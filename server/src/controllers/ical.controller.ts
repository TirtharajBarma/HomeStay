import type { Request, Response } from "express";
import { IcalService } from "../services/ical.service.js";

export class IcalController {
  /**
   * Outbound iCal feed for an accommodation unit.
   * Format: GET /api/v1/rooms/:codeOrSlug/calendar.ics
   */
  static async exportIcal(req: Request, res: Response) {
    try {
      const codeOrSlug = req.params.codeOrSlug as string;
      const ownerId = req.query.ownerId as string | undefined;

      const ics = await IcalService.generateIcal(codeOrSlug, ownerId);

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=room-${codeOrSlug}-calendar.ics`
      );
      res.status(200).send(ics);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to generate iCal feed" });
    }
  }

  /**
   * Inbound sync of external Airbnb .ics feed.
   * Format: POST /api/v1/rooms/:codeOrSlug/sync-ical
   */
  static async syncInboundIcal(req: Request, res: Response) {
    try {
      const codeOrSlug = req.params.codeOrSlug as string;
      const { icalUrl } = req.body;
      const user = (req as any).user;

      if (!icalUrl) {
        return res.status(400).json({ success: false, error: "Missing required 'icalUrl' parameter" });
      }

      const result = await IcalService.syncInboundIcal(
        codeOrSlug,
        icalUrl,
        user?.id,
        user?.propertyId
      );

      res.json({
        success: true,
        message: `Successfully synchronized ${result.syncedCount} external calendar dates.`,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || "Failed to sync external iCal feed" });
    }
  }
}
