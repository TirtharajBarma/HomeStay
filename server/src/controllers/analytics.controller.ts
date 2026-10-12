import type { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service.js";

export class AnalyticsController {
  static async getAnalytics(req: Request, res: Response) {
    const user = (req as any).user;
    const range = (req.query.range as string) || "month";
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const ownerId = (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined);
    const data = await AnalyticsService.getAnalytics(range, offset, ownerId);
    res.json({ success: true, data });
  }

  static async exportCsv(req: Request, res: Response) {
    const user = (req as any).user;
    const range = (req.query.range as string) || "month";
    const ownerId = (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined);
    const csv = await AnalyticsService.generateCsvExport(range, ownerId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=homestay-analytics-${range}.csv`);
    res.status(200).send(csv);
  }
}
