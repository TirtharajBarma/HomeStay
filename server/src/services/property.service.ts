import { Property, type IProperty, type IEstateLocation } from "../models/property.model.js";
import { Room } from "../models/room.model.js";
import { initialProperty } from "../data/seeds/profile.seed.js";
import { getStayRideTenantModel } from "../stayride/store.js";

export class PropertyService {
  static async getProfile(ownerId?: string): Promise<IProperty> {
    const filter = ownerId ? { ownerId } : {};
    let prop = await Property.findOne(filter);
    if (!prop) {
      if (ownerId) {
        prop = await Property.create({
          name: "Homestay Estate",
          role: "Estate Owner & Host",
          email: "",
          phone: "+91 98000 00000",
          address: "Darjeeling Hills",
          town: "Darjeeling",
          region: "West Bengal",
          postal: "734101",
          bio: "Welcome to our homestay in the hills.",
          checkInTime: "3:00 PM",
          checkOutTime: "11:00 AM",
          responseTime: "Usually within 1 hour",
          currency: "INR",
          locations: [],
          ownerId,
        });
      } else {
        prop = await Property.findOne();
        if (!prop) {
          prop = await Property.create(initialProperty);
        }
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

  static async getAllProperties(): Promise<any[]> {
    const properties: any[] = await Property.find({
      status: { $ne: "suspended" as any },
      email: { $not: /@stayride\.test$/i },
    }).sort({ createdAt: -1 }).lean();
    return await Promise.all(
      properties.map(async (prop: any) => {
        let rooms = await Room.find({ propertyId: (prop as any)._id }).lean();
        let photos = (prop as any).photos || [];
        if (prop.email) {
          try {
            const tenantDoc: any = await getStayRideTenantModel(false)
              .findOne({ tenantId: prop.email.toLowerCase().trim() })
              .lean();
            if (tenantDoc?.data) {
              const tenantRooms = tenantDoc.data.rooms || [];
              const tenantHomestay = tenantDoc.data.homestay || {};
              if (Array.isArray(tenantHomestay.photos) && tenantHomestay.photos.length) {
                photos = [...tenantHomestay.photos, ...photos];
              }
              if ((!rooms || rooms.length === 0) && tenantRooms.length > 0) {
                rooms = tenantRooms.map((tr: any) => ({
                  _id: `tr_${tr.id}`,
                  code: `${(prop as any).slug || "stay"}-${tr.number || tr.id}`,
                  slug: `${(prop as any).slug || "stay"}-${tr.number || tr.id}`,
                  name: `${tr.type || "Room"} ${tr.number}`,
                  number: tr.number,
                  floor: tr.floor,
                  note: tr.note,
                  propertyId: (prop as any)._id,
                  homestayName: prop.name,
                  location: prop.address || prop.town || "Darjeeling",
                  category: tr.type || "Standard",
                  kind: "cottage",
                  kindLabel: tr.type || "Standard Room",
                  status: tr.status === "MAINTENANCE" ? "Maintenance" : "Active",
                  petFriendly: true,
                  maxGuests: tr.type === "Family" ? 4 : tr.type === "Suite" ? 3 : 2,
                  occupancy: tr.type === "Family" ? "4 Guests" : "2 Guests",
                  nightly: Number(tr.price) || 2000,
                  price: Number(tr.price) || 2000,
                  amenities: ["Mountain View", "Verified Host", "Door-to-door Cab Transfer", "Hot Water Geyser"],
                }));
              }
            }
          } catch {}
        }
        return { ...prop, photos, rooms };
      })
    );
  }

  static async getPropertyBySlug(slug: string): Promise<any | null> {
    const clean = String(slug || "").trim().toLowerCase();
    let prop = await Property.findOne({ slug: clean }).lean();
    if (!prop && clean.includes("@")) {
      prop = await Property.findOne({ email: clean }).lean();
    }
    if (!prop && clean.match(/^[0-9a-fA-F]{24}$/)) {
      prop = await Property.findById(clean).lean();
    }
    if (!prop) {
      try {
        const tenantByLink: any = await getStayRideTenantModel(false)
          .findOne({
            $or: [
              { "data.homestay.link": new RegExp(`/${clean}$`, "i") },
              { tenantId: clean },
            ],
          })
          .lean();
        if (tenantByLink) {
          prop = await Property.findOne({ email: tenantByLink.tenantId }).lean();
        }
      } catch {}
    }
    if (!prop) return null;

    let rooms = await Room.find({ propertyId: (prop as any)._id }).lean();
    let photos = (prop as any).photos || [];

    if (prop.email) {
      try {
        const tenantDoc: any = await getStayRideTenantModel(false)
          .findOne({ tenantId: prop.email.toLowerCase().trim() })
          .lean();
        if (tenantDoc?.data) {
          const tenantRooms = tenantDoc.data.rooms || [];
          const tenantHomestay = tenantDoc.data.homestay || {};
          if (Array.isArray(tenantHomestay.photos) && tenantHomestay.photos.length) {
            photos = [...tenantHomestay.photos, ...photos];
          }
          if ((!rooms || rooms.length === 0) && tenantRooms.length > 0) {
            rooms = tenantRooms.map((tr: any) => ({
              _id: `tr_${tr.id}`,
              code: `${(prop as any).slug || "stay"}-${tr.number || tr.id}`,
              slug: `${(prop as any).slug || "stay"}-${tr.number || tr.id}`,
              name: `${tr.type || "Room"} ${tr.number}`,
              number: tr.number,
              floor: tr.floor,
              note: tr.note,
              propertyId: (prop as any)._id,
              homestayName: prop.name,
              location: prop.address || prop.town || "Darjeeling",
              category: tr.type || "Standard",
              kind: "cottage",
              kindLabel: tr.type || "Standard Room",
              status: tr.status === "MAINTENANCE" ? "Maintenance" : "Active",
              petFriendly: true,
              maxGuests: tr.type === "Family" ? 4 : tr.type === "Suite" ? 3 : 2,
              occupancy: tr.type === "Family" ? "4 Guests" : "2 Guests",
              nightly: Number(tr.price) || 2000,
              price: Number(tr.price) || 2000,
              amenities: ["Mountain View", "Verified Host", "Door-to-door Cab Transfer", "Hot Water Geyser"],
            }));
          }
        }
      } catch {}
    }

    return { ...prop, photos, rooms };
  }

  static async addLocation(location: Partial<IEstateLocation>, ownerId?: string): Promise<IProperty> {
    const prop = await this.getProfile(ownerId);
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
    updates: Partial<IEstateLocation>,
    ownerId?: string
  ): Promise<IProperty> {
    const prop = await this.getProfile(ownerId);
    const loc = prop.locations.find((l) => l.id === locationId);
    if (!loc) {
      throw new Error(`Location with id ${locationId} not found`);
    }
    Object.assign(loc, updates);
    prop.markModified("locations");
    await prop.save();
    return prop;
  }

  static async deleteLocation(locationId: string, ownerId?: string): Promise<IProperty> {
    const prop = await this.getProfile(ownerId);
    prop.locations = prop.locations.filter((l) => l.id !== locationId);
    prop.markModified("locations");
    await prop.save();
    return prop;
  }
}
