import { z } from "zod";

export const CreateDriverSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Driver name is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email("Valid email required").optional().default("driver@local-fleet.com"),
  vehicle: z.string().min(1, "Vehicle make and model required"),
  plate: z.string().min(1, "License plate is required"),
  seats: z.coerce.number().min(2).default(4),
  coverage: z.string().default("Darjeeling Area"),
  status: z
    .enum(["Active", "On a trip", "Invited", "Paused", "Inactive", "Available", "Busy", "On Duty"])
    .default("Invited"),
});

export const DriverStatusSchema = z.object({
  status: z.enum([
    "Active",
    "On a trip",
    "Invited",
    "Paused",
    "Inactive",
    "Available",
    "Busy",
    "On Duty",
  ]),
});

export const TripStatusSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
});

export const CabQuoteSchema = z
  .object({
    fromLat: z.coerce.number().optional(),
    fromLng: z.coerce.number().optional(),
    toLat: z.coerce.number().optional(),
    toLng: z.coerce.number().optional(),
    pickupCoords: z.array(z.coerce.number()).optional(),
    dropoffCoords: z.array(z.coerce.number()).optional(),
    pickup: z.string().optional(),
    dropoff: z.string().optional(),
    seats: z.coerce.number().default(4),
  })
  .transform((data) => ({
    fromLat: data.fromLat ?? (data.pickupCoords ? data.pickupCoords[1] : 27.041),
    fromLng: data.fromLng ?? (data.pickupCoords ? data.pickupCoords[0] : 88.2627),
    toLat: data.toLat ?? (data.dropoffCoords ? data.dropoffCoords[1] : 26.6812),
    toLng: data.toLng ?? (data.dropoffCoords ? data.dropoffCoords[0] : 88.3286),
    seats: data.seats,
  }));

export const CreateCabBookingSchema = z
  .object({
    driverId: z.string().min(1, "Driver ID is required"),
    guestName: z.string().min(1, "Guest name is required"),
    email: z.string().email().optional(),
    phone: z.string().min(7, "Valid phone required"),
    pickup: z.string().optional(),
    pickupName: z.string().optional(),
    pickupLat: z.coerce.number().optional(),
    pickupLng: z.coerce.number().optional(),
    pickupCoords: z.array(z.coerce.number()).optional(),
    dropoff: z.string().optional(),
    dropoffName: z.string().optional(),
    dropoffLat: z.coerce.number().optional(),
    dropoffLng: z.coerce.number().optional(),
    dropoffCoords: z.array(z.coerce.number()).optional(),
    date: z.string().optional(),
    pickupDate: z.string().optional(),
    time: z.string().optional(),
    pickupTime: z.string().optional(),
    seats: z.coerce.number().min(1).default(4),
    totalFare: z.coerce.number().optional(),
  })
  .transform((data) => ({
    driverId: data.driverId,
    guestName: data.guestName,
    email: data.email || "guest@hillstay.com",
    phone: data.phone,
    pickupName: data.pickupName || data.pickup || "Pickup Location",
    pickupLat: data.pickupLat ?? (data.pickupCoords ? data.pickupCoords[1] : 26.6812),
    pickupLng: data.pickupLng ?? (data.pickupCoords ? data.pickupCoords[0] : 88.3286),
    dropoffName: data.dropoffName || data.dropoff || "Dropoff Location",
    dropoffLat: data.dropoffLat ?? (data.dropoffCoords ? data.dropoffCoords[1] : 27.041),
    dropoffLng: data.dropoffLng ?? (data.dropoffCoords ? data.dropoffCoords[0] : 88.2627),
    pickupDate: data.pickupDate || data.date || new Date().toISOString().slice(0, 10),
    pickupTime: data.pickupTime || data.time || "12:00 PM",
    seats: data.seats,
  }));
