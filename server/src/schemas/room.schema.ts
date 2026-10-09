import { z } from "zod";

export const CreateRoomSchema = z
  .object({
    code: z.string().min(1, "Room code is required"),
    slug: z.string().optional(),
    ownerId: z.string().optional(),
    propertyId: z.string().optional(),
    homestayName: z.string().optional(),
    name: z.string().min(1, "Room name is required"),
    location: z.string().default("Darjeeling Hills"),
    category: z.string().default("Garden Cottages"),
    kind: z.enum(["cottage", "loft", "cabin", "suite"]).default("cottage"),
    status: z.enum(["Active", "Maintenance"]).default("Active"),
    petFriendly: z.boolean().default(false),
    maxGuests: z.coerce.number().min(1).default(2),
    nightly: z.coerce.number().min(100, "Nightly rate required"),
    weekend: z.coerce.number().optional(),
    bedLabel: z.string().optional(),
    bedIcon: z.string().optional(),
    blurb: z.string().optional(),
    amenities: z.array(z.string()).default([]),
    image: z
      .string()
      .default("https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80"),
    images: z.array(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    slug:
      data.slug ||
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
  }));

export const MaintenanceHoldSchema = z
  .object({
    label: z.string().optional(),
    reason: z.string().optional(),
    range: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .transform((data) => ({
    label: data.label || data.reason || "Scheduled Maintenance",
    range:
      data.range ||
      (data.startDate && data.endDate
        ? `${data.startDate} – ${data.endDate}`
        : "Current Hold"),
    startDate: data.startDate,
    endDate: data.endDate,
  }));
