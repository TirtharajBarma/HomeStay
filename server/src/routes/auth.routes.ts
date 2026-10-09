import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { RegisterSchema, LoginSchema } from "../schemas/auth.schema.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

router.post("/register", validate(RegisterSchema, "body"), AuthController.register);
router.post("/login", validate(LoginSchema, "body"), AuthController.login);
router.get("/me", verifyToken, AuthController.me);

export default router;
