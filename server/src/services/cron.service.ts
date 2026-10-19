import { Property } from "../models/property.model.js";
import { Room } from "../models/room.model.js";
import { IcalService } from "./ical.service.js";

export class CronService {
  private static timer: NodeJS.Timeout | null = null;

  static startIcalWorker(intervalMinutes = 15) {
    // Serverless platforms (Vercel) freeze the process between requests, so a long-lived
    // setInterval never fires reliably and would run duplicated across instances. Use an external
    // scheduler (e.g. a Vercel Cron hitting a route) instead.
    if (process.env.VERCEL) {
      console.log(
        "⏱️  [CRON WORKER] Skipped in-process iCal worker on Vercel (use an external scheduler)."
      );
      return;
    }

    console.log(
      `⏱️  [CRON WORKER] Initialized automatic background iCal sync (every ${intervalMinutes} mins)`
    );

    const runSync = async () => {
      try {
        const propertiesWithFeeds = await Property.find({
          "icalFeeds.airbnbUrl": { $exists: true, $ne: "" },
        });

        for (const prop of propertiesWithFeeds) {
          const airbnbUrl = prop.icalFeeds?.airbnbUrl;
          if (!airbnbUrl) continue;

          const filter: any = {
            $or: [{ propertyId: prop._id }, { ownerId: prop.ownerId }],
          };
          const rooms = await Room.find(filter);

          for (const room of rooms) {
            const roomDoc = room as any;
            try {
              const res = await IcalService.syncInboundIcal(roomDoc.code, airbnbUrl);
              console.log(
                `⏱️  [CRON WORKER] Auto-synced ${res.syncedCount} dates for room ${roomDoc.code} (${prop.name})`
              );
            } catch (syncErr: any) {
              console.warn(
                `⏱️  [CRON WORKER] Feed sync notice for room ${roomDoc.code}: ${syncErr.message}`
              );
            }
          }

          if (prop.icalFeeds) {
            prop.icalFeeds.lastSyncedAt = new Date();
            await prop.save();
          }
        }
      } catch (err: any) {
        console.warn("⏱️  [CRON WORKER] Error during periodic iCal execution:", err.message);
      }
    };

    // Run first check 10 seconds after server launch, then repeat every intervalMinutes
    setTimeout(runSync, 10_000);
    this.timer = setInterval(runSync, intervalMinutes * 60 * 1000);
  }

  static stopWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
