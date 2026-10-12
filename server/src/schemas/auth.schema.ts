import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["guest", "owner"]).default("owner"),
  phone: z.string().optional(),
  homestayName: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const GoogleAuthSchema = z.object({
  credential: z.string().optional(),
  googleToken: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(["guest", "owner"]).default("owner"),
  homestayName: z.string().optional(),
});

export const SendOtpSchema = z.object({
  phone: z.string().min(10, "Valid phone number is required"),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().min(10, "Valid phone number is required"),
  otp: z.string().min(4, "OTP must be at least 4 digits"),
  name: z.string().optional(),
  role: z.enum(["guest", "owner"]).default("owner"),
  homestayName: z.string().optional(),
});

export const DriverLoginSchema = z.object({
  phone: z.string().min(7, "Valid phone number is required"),
  pin: z.string().min(4, "4-digit PIN is required"),
});
