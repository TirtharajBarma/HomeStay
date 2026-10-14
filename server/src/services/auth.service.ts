import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/user.model.js";
import { Property } from "../models/property.model.js";
import { Driver } from "../models/driver.model.js";
import { config } from "../config/env.js";

// In-memory OTP store for free development/testing
const otpStore = new Map<string, { otp: string; expires: number }>();

export class AuthService {
  static generateToken(user: { _id: any; email: string; name: string; role: string; propertyId?: any }) {
    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      propertyId: user.propertyId ? user.propertyId.toString() : undefined,
    };

    const expiresIn = config.jwtExpiresIn || "15m";
    const expiresInSeconds = 15 * 60;
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
    const existing = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (existing) {
      throw new Error(`User with email '${data.email}' already exists.`);
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
    const user = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
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
      if (config.nodeEnv === "production") {
        throw new Error("Demo token authentication is disabled in production.");
      }
    } else if (rawToken) {
      try {
        const decoded: any = jwt.decode(rawToken);
        if (decoded && decoded.email) {
          email = decoded.email.toLowerCase().trim();
          name = decoded.name || decoded.given_name || email.split("@")[0];
          avatar = decoded.picture || "";
        }
      } catch {
        // Fallback to provided credentials
      }
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
    const otp = "123456"; // Development/demo OTP default
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(cleanPhone, { otp, expires });
    console.log(`\n📲 [OTP DISPATCH] -> Phone: ${cleanPhone} | Verification Code: ${otp}\n`);

    return {
      success: true,
      message: "OTP sent successfully (Demo OTP: 123456)",
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

    // In production, universal dev OTP '123456' is rejected unless actively stored
    const isDev = config.nodeEnv !== "production";
    const isMatch =
      (isDev && data.otp === "123456") ||
      (stored && stored.otp === data.otp && Date.now() <= stored.expires);
    if (!isMatch) {
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
