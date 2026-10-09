import type { Request, Response } from "express";
import { PropertyService } from "../services/property.service.js";

export class PropertyController {
  static async getProfile(req: Request, res: Response) {
    const user = (req as any).user;
    const ownerId = (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined);
    const profile = await PropertyService.getProfile(ownerId);
    res.json({ success: true, data: profile });
  }

  static async updateProfile(req: Request, res: Response) {
    const user = (req as any).user;
    const ownerId = (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined);
    const updated = await PropertyService.updateProfile(req.body, ownerId);
    res.json({ success: true, data: updated });
  }

  static async getAllProperties(_req: Request, res: Response) {
    const properties = await PropertyService.getAllProperties();
    res.json({ success: true, count: properties.length, data: properties });
  }

  static async getPropertyBySlug(req: Request, res: Response) {
    const slug = req.params.slug as string;
    const property = await PropertyService.getPropertyBySlug(slug);
    if (!property) {
      return res.status(404).json({ success: false, error: `Property '${slug}' not found` });
    }
    res.json({ success: true, data: property });
  }

  static async addLocation(req: Request, res: Response) {
    const updated = await PropertyService.addLocation(req.body);
    res.status(201).json({ success: true, data: updated });
  }

  static async updateLocation(req: Request, res: Response) {
    const locationId = req.params.id as string;
    const updated = await PropertyService.updateLocation(locationId, req.body);
    res.json({ success: true, data: updated });
  }

  static async deleteLocation(req: Request, res: Response) {
    const locationId = req.params.id as string;
    const updated = await PropertyService.deleteLocation(locationId);
    res.json({ success: true, data: updated });
  }
}
