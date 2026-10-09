import { z } from "zod";

export const CreateBookingSchema = z.object({
  stay: z.string().optional(),
  roomCode: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
  guests: z.coerce.number().min(1, "At least 1 guest required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Valid phone number required"),
  arrivalWindow: z.string().optional(),
  breakfasts: z.array(z.string()).optional(),
  paymentPlan: z.enum(["card_full", "deposit"]).optional(),
  channel: z.string().optional(),
  notes: z.string().optional(),
});

export const QuoteQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
  guests: z.coerce.number().min(1).optional(),
});
