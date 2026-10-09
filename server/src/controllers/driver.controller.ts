import type { Request, Response } from "express";
import { DriverService } from "../services/driver.service.js";

export class DriverController {
  static getPlaces(_req: Request, res: Response) {
    const places = DriverService.getPlaces();
    res.json({ success: true, count: places.length, data: places });
  }

  static async getDrivers(req: Request, res: Response) {
    const filters = {
      seats: req.query.seats ? Number(req.query.seats) : undefined,
      status: req.query.status as string,
    };
    const drivers = await DriverService.getDrivers(filters);
    res.json({ success: true, count: drivers.length, data: drivers });
  }

  static async calculateQuote(req: Request, res: Response) {
    const { fromLat, fromLng, toLat, toLng, seats } = req.body;
    const result = await DriverService.calculateQuote(
      Number(fromLat),
      Number(fromLng),
      Number(toLat),
      Number(toLng),
      seats ? Number(seats) : 4
    );
    res.json({ success: true, ...result });
  }

  static async createCabBooking(req: Request, res: Response) {
    try {
      const trip = await DriverService.createCabBooking(req.body);
      res.status(201).json({ success: true, data: trip });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || "Failed to book cab" });
    }
  }

  static async addDriver(req: Request, res: Response) {
    const driver = await DriverService.addDriver(req.body);
    res.status(201).json({ success: true, data: driver });
  }

  static async updateStatus(req: Request, res: Response) {
    const { status } = req.body;
    const driver = await DriverService.updateDriverStatus(req.params.id as string, status);
    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver not found" });
    }
    res.json({ success: true, data: driver });
  }

  static async getPayouts(_req: Request, res: Response) {
    const ledger = await DriverService.getPayoutsLedger();
    res.json({ success: true, data: ledger });
  }
}
