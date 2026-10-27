import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, type IUser } from "../models/user.model.js";
import { Property } from "../models/property.model.js";
import { Driver } from "../models/driver.model.js";
import { config } from "../config/env.js";
import { tenantDbModel } from "../utils/tenant-model.js";

// Development conveniences (fixed OTP, demo tokens) are never available on Vercel or with NODE_ENV=production.
const devConveniences = !config.isDeployed && config.nodeEnv !== "production";

// In-memory OTP store for free development/testing
const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();

export class AuthService {
  static generateToken(user: { _id: any; email: string; name: string; role: string; propertyId?: any; tokenVersion?: number }) {
    const payload = {
      tv: user.tokenVersion || 0, // session version; admin routes reject tokens after a revoke
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      propertyId: user.propertyId ? user.propertyId.toString() : undefined,
    };

    const isAdmin = user.role === "admin";
    const expiresIn = isAdmin ? "24h" : (config.jwtExpiresIn || "30d");
    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: expiresIn as any });
    return { token, expiresIn, expiresInSeconds };
  }

  static async ensureOwnerProperty(user: IUser, homestayName?: string): Promise<any> {
    let property: any = await Property.findOne({ ownerId: user._id as any });
    if (!property) {
      const baseName = homestayName?.trim() || `${user.name} Homestay`;
      const baseSlug = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const existingSlug = await Property.findOne({ slug: baseSlug });
      const slug = existingSlug ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

      const newProp = new Property({
        ownerId: user._id,
        name: baseName,
        slug,
        email: user.email,
        phone: user.phone || "+91 98300 00000",
        address: "Darjeeling Hills",
        town: "Darjeeling",
        status: "active",
      });
      await newProp.save();
      property = newProp;

      user.propertyId = property._id as any;
      await user.save();
    }
    return property;
  }

  static async register(data: {
    name: string;
    email: string;
    password: string;
    role?: "guest" | "owner";
    phone?: string;
    homestayName?: string;
  }) {
    const cleanEmail = data.email.toLowerCase().trim();
    const reservedEmails = [
      'demo@stayride.in',
      'driver@stayride.in',
      'demo-driver@stayride.in',
      'stay@mountainviewgangtok.com',
      'stay@mountainview.in',
      (config.demoHostEmail || '').toLowerCase().trim(),
      (config.demoDriverEmail || '').toLowerCase().trim(),
    ].filter(Boolean);
    if (reservedEmails.includes(cleanEmail)) {
      throw new Error(`The email '${cleanEmail}' is reserved for demo showcase accounts and cannot be registered.`);
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw new Error(`User with email '${cleanEmail}' already exists.`);
    }

    const assignedRole = data.role === "guest" ? "guest" : "owner";

    const user = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password: data.password,
      role: assignedRole,
      phone: data.phone || "",
    });

    let property: any = null;
    if (user.role === "owner") {
      property = await this.ensureOwnerProperty(user, data.homestayName);
    }

    const { token, expiresIn, expiresInSeconds } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        propertyId: property?._id,
        propertySlug: property?.slug,
        propertyName: property?.name,
      },
      token,
      expiresIn,
      expiresInSeconds,
    };
  }

  static async login(data: { email: string; password: string }) {
    // Same live-database user collection the StayRide admin routes re-check on every request.
    const user: any = await tenantDbModel(false, "User", User.schema).findOne({ email: data.email.toLowerCase().trim() });
    // One message for every failure: never reveal whether the account exists or is blocked.
    if (!user || !(await user.comparePassword(data.password)) || user.accountStatus === "BLOCKED") {
      throw new Error("Invalid email or password.");
    }

    let property: any = null;
    if (user.role === "owner") {
      property = await this.ensureOwnerProperty(user);
    }

    const { token, expiresIn, expiresInSeconds } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        propertyId: property?._id,
        propertySlug: property?.slug,
        propertyName: property?.name,
      },
      token,
      expiresIn,
      expiresInSeconds,
    };
  }

  static async refreshToken(oldToken: string) {
    let decoded: any;
    try {
      // Decode and verify signature, allowing expired tokens within grace renewal window
      decoded = jwt.verify(oldToken, config.jwtSecret, { ignoreExpiration: true });
    } catch {
      throw new Error("Invalid token signature.");
    }

    if (!decoded || !decoded.id) {
      throw new Error("Malformed token payload.");
    }

    if (decoded.aud === "stayride") {
      throw new Error("Invalid token audience.");
    }

    // Allow renewal up to 60 days after issue
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp && nowSec - decoded.exp > 60 * 24 * 3600) {
      throw new Error("Session has expired beyond renewal window. Please log in again.");
    }

    const user: any = await tenantDbModel(false, "User", User.schema).findById(decoded.id);
    if (!user) {
      throw new Error("User account no longer exists.");
    }

    if (user.accountStatus === "BLOCKED") {
      throw new Error("User account is blocked.");
    }

    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new Error("Session has been revoked. Please sign in again.");
    }

    let property: any = null;
    if (user.role === "owner") {
      property = await this.ensureOwnerProperty(user);
    }

    const { token, expiresIn, expiresInSeconds } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        propertyId: property?._id || user.propertyId,
        propertySlug: property?.slug,
        propertyName: property?.name,
      },
      token,
      expiresIn,
      expiresInSeconds,
    };
  }

  static async googleAuth(data: {
    credential?: string;
    googleToken?: string;
    email?: string;
    name?: string;
    role?: "guest" | "owner";
    homestayName?: string;
  }) {
    const rawToken = data.credential || data.googleToken || "";
    let email = data.email?.toLowerCase().trim() || "";
    let name = data.name?.trim() || "";
    let avatar = "";

    if (rawToken && rawToken.startsWith("demo_")) {
      if (!devConveniences) {
        throw new Error("Demo token authentication is disabled in production.");
      }
    } else if (rawToken) {
      // Verify the Google ID token server-side. A JWT decode alone trusts attacker-supplied
      // claims; Google's tokeninfo endpoint validates the signature, issuer and expiry.
      let info: any;
      try {
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawToken)}`
        );
        if (!res.ok) throw new Error("Google token verification failed.");
        info = await res.json();
      } catch {
        throw new Error("Invalid Google credential token.");
      }
      const verifiedEmail = String(info?.email || "").toLowerCase().trim();
      const emailVerified = info?.email_verified === true || info?.email_verified === "true";
      if (!verifiedEmail || !emailVerified) {
        throw new Error("Google account email is not verified.");
      }
      if (config.googleClientId && String(info?.aud || "") !== config.googleClientId) {
        throw new Error("Google token was issued for a different client.");
      }
      email = verifiedEmail;
      name = info?.name || info?.given_name || verifiedEmail.split("@")[0];
      avatar = info?.picture || "";
    } else if (config.isDeployed || config.nodeEnv === "production" || process.env.ALLOW_DEV_OAUTH_MOCK !== "true") {
      // No token to verify: never trust a bare email in production or standard environments.
      throw new Error("A valid Google credential is required.");
    }

    if (!email) {
      throw new Error("Invalid Google credential token or missing email.");
    }
    if (!name) {
      name = email.split("@")[0];
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: `google_oauth_${Date.now()}_${Math.random().toString(36)}`,
        role: data.role || "owner",
        avatar,
      });
    }

    let property: any = null;
    if (user.role === "owner") {
      property = await this.ensureOwnerProperty(user, data.homestayName);
    }

    const { token, expiresIn } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        propertyId: property?._id,
        propertySlug: property?.slug,
        propertyName: property?.name,
      },
      token,
      expiresIn,
    };
  }

  static async sendOtp(phone: string) {
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    const isDev = devConveniences;
    // The universal "123456" code is a development convenience only. In production a random
    // code is generated and the value is never logged or echoed back in the response.
    const otp = isDev ? "123456" : String(crypto.randomInt(100000, 1000000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(cleanPhone, { otp, expires, attempts: 0 });
    if (isDev) {
      console.log(`\n📲 [OTP DISPATCH] -> Phone: ${cleanPhone} | Verification Code: ${otp}\n`);
    } else {
      console.log(`📲 [OTP DISPATCH] -> Phone: ${cleanPhone} (code withheld in production)`);
    }

    return {
      success: true,
      message: isDev ? "OTP sent successfully (Demo OTP: 123456)" : "OTP sent successfully.",
      phone: cleanPhone,
    };
  }

  static async verifyOtp(data: {
    phone: string;
    otp: string;
    name?: string;
    role?: "guest" | "owner";
    homestayName?: string;
  }) {
    const cleanPhone = data.phone.replace(/[^0-9+]/g, "");
    const stored = otpStore.get(cleanPhone);

    // Cap brute-force attempts per issued code.
    if (stored && stored.attempts >= 5) {
      otpStore.delete(cleanPhone);
      throw new Error("Too many invalid attempts. Please request a new OTP.");
    }

    // In production, universal dev OTP '123456' is rejected unless actively stored
    const isDev = devConveniences;
    const isMatch =
      (isDev && data.otp === "123456") ||
      (stored && stored.otp === data.otp && Date.now() <= stored.expires);
    if (!isMatch) {
      if (stored) stored.attempts += 1;
      throw new Error("Invalid or expired OTP.");
    }

    otpStore.delete(cleanPhone);

    const email = `${cleanPhone.replace(/[^0-9]/g, "")}@phone.user`;
    let user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      user = await User.create({
        name: data.name?.trim() || `Host ${cleanPhone.slice(-4)}`,
        email,
        password: `otp_auth_${Date.now()}_${Math.random().toString(36)}`,
        phone: cleanPhone,
        role: data.role || "owner",
      });
    }

    let property: any = null;
    if (user.role === "owner") {
      property = await this.ensureOwnerProperty(user, data.homestayName);
    }

    const { token, expiresIn } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        propertyId: property?._id,
        propertySlug: property?.slug,
        propertyName: property?.name,
      },
      token,
      expiresIn,
    };
  }

  static async driverLogin(data: { phone: string; pin: string }) {
    const cleanPhone = data.phone.trim();
    const driver = await Driver.findOne({ phone: cleanPhone });

    if (!driver) {
      throw new Error("Driver with this phone number not found in fleet roster.");
    }

    if (!driver.pin || driver.pin !== data.pin) {
      throw new Error("Invalid driver security PIN.");
    }

    const payload = {
      id: driver.id,
      name: driver.name,
      role: "driver",
      phone: driver.phone,
      vehicle: driver.vehicle,
      plate: driver.plate,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: "30d" });

    return {
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicle,
        plate: driver.plate,
        seats: driver.seats,
        status: driver.status,
        trips: driver.trips,
        commission: driver.commission,
      },
      token,
      expiresIn: "30d",
    };
  }

  static async getProfile(userId: string) {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new Error("User not found.");
    }
    return user;
  }
}
