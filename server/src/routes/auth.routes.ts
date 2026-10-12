import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  RegisterSchema,
  LoginSchema,
  GoogleAuthSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  DriverLoginSchema,
} from "../schemas/auth.schema.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

router.post("/register", validate(RegisterSchema, "body"), AuthController.register);
router.post("/login", validate(LoginSchema, "body"), AuthController.login);
router.post("/google", validate(GoogleAuthSchema, "body"), AuthController.google);
router.post("/otp/send", validate(SendOtpSchema, "body"), AuthController.sendOtp);
router.post("/otp/verify", validate(VerifyOtpSchema, "body"), AuthController.verifyOtp);
router.post("/driver/login", validate(DriverLoginSchema, "body"), AuthController.driverLogin);
router.get("/me", verifyToken, AuthController.me);

export default router;
