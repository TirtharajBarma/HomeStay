import type { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        message: "User registered successfully.",
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || "Registration failed.",
      });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);
      res.json({
        success: true,
        message: "Login successful.",
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || "Authentication failed.",
      });
    }
  }

  static async google(req: Request, res: Response) {
    try {
      const result = await AuthService.googleAuth(req.body);
      res.json({
        success: true,
        message: "Google authentication successful.",
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || "Google authentication failed.",
      });
    }
  }

  static async sendOtp(req: Request, res: Response) {
    try {
      const result = await AuthService.sendOtp(req.body.phone);
      res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || "Failed to dispatch OTP.",
      });
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const result = await AuthService.verifyOtp(req.body);
      res.json({
        success: true,
        message: "OTP verification successful.",
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || "OTP verification failed.",
      });
    }
  }

  static async driverLogin(req: Request, res: Response) {
    try {
      const result = await AuthService.driverLogin(req.body);
      res.json({
        success: true,
        message: "Driver login successful.",
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || "Driver login failed.",
      });
    }
  }

  static async me(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: "Unauthorized." });
      }
      const user = await AuthService.getProfile(req.user.id);
      res.json({
        success: true,
        data: user,
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: err.message || "User profile not found.",
      });
    }
  }
}
