import { Property, type IProperty, type IEstateLocation } from "../models/property.model.js";
import { initialProperty } from "../data/seeds/profile.seed.js";

export class PropertyService {
  static async getProfile(ownerId?: string): Promise<IProperty> {
    const filter = ownerId ? { ownerId } : {};
    let prop = await Property.findOne(filter);
    if (!prop) {
      if (ownerId) {
        prop = await Property.create({ ...initialProperty, ownerId, name: "Homestay Estate" });
      } else {
        prop = await Property.create(initialProperty);
      }
    }
    return prop;
  }

  static async updateProfile(data: Partial<IProperty>, ownerId?: string): Promise<IProperty> {
    const filter = ownerId ? { ownerId } : {};
    let prop = await Property.findOne(filter);
    if (!prop) {
      prop = await Property.create({ ...initialProperty, ...data, ...(ownerId ? { ownerId } : {}) });
    } else {
      Object.assign(prop, data);
      await prop.save();
    }
    return prop;
  }

  static async getAllProperties(): Promise<IProperty[]> {
    return await Property.find().sort({ createdAt: -1 });
  }

  static async getPropertyBySlug(slug: string): Promise<IProperty | null> {
    return await Property.findOne({ slug: slug.toLowerCase() });
  }

  static async addLocation(location: Partial<IEstateLocation>): Promise<IProperty> {
    const prop = await this.getProfile();
    const newLoc: IEstateLocation = {
      id: location.id || `loc_${Date.now()}`,
      name: location.name || "Untitled Location",
      address: location.address || "Darjeeling, WB",
      kind: location.kind || "Property",
      units: location.units ?? 1,
      note: location.note || "",
      lat: location.lat ?? null,
      lng: location.lng ?? null,
    };
    prop.locations.push(newLoc);
    await prop.save();
    return prop;
  }

  static async updateLocation(
    locationId: string,
    updates: Partial<IEstateLocation>
  ): Promise<IProperty> {
    const prop = await this.getProfile();
    const loc = prop.locations.find((l) => l.id === locationId);
    if (!loc) {
      throw new Error(`Location with id ${locationId} not found`);
    }
    Object.assign(loc, updates);
    prop.markModified("locations");
    await prop.save();
    return prop;
  }

  static async deleteLocation(locationId: string): Promise<IProperty> {
    const prop = await this.getProfile();
    prop.locations = prop.locations.filter((l) => l.id !== locationId);
    prop.markModified("locations");
    await prop.save();
    return prop;
  }
}
