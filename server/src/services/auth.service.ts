import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/user.model.js";
import { config } from "../config/env.js";

export class AuthService {
  static generateToken(user: IUser): { token: string; expiresInSeconds: number } {
    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };
    // 15-minute token lifetime as requested
    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: "15m",
    });
    return { token, expiresInSeconds: 15 * 60 };
  }

  static async register(data: {
    name: string;
    email: string;
    password: string;
    role?: "guest" | "owner" | "admin";
    phone?: string;
  }) {
    const existing = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (existing) {
      throw new Error(`User with email '${data.email}' already exists.`);
    }

    const user = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password: data.password,
      role: data.role || "guest",
      phone: data.phone || "",
    });

    const { token, expiresInSeconds } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      token,
      expiresIn: "15m",
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

    const { token, expiresInSeconds } = this.generateToken(user);
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      token,
      expiresIn: "15m",
      expiresInSeconds,
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
