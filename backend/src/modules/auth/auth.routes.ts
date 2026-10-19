import { Router, Request, Response, NextFunction } from "express";
import env from "../../config/env";
import { body } from "express-validator";
import authController from "./auth.controller";
import validateRequest from "../../middlewares/validate.middleware";
import { authRateLimitMiddleware } from "../../middlewares/rateLimit.middleware";
import authMiddleware, { optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import googleRoutes from "./google.routes";
import passkeyRoutes from "./passkey.routes";

const router = Router();

router.use(googleRoutes); // Google link + password reset (no SMS)
router.use(passkeyRoutes); // Face ID / fingerprint sign-in

// OTP / SMS verification is switched off (OTP_ENABLED=false). These routes answer 503 until the owner turns it on.
const needsOtp = (_req: Request, res: Response, next: NextFunction) => {
  if (!env.OTP_ENABLED) {
    return res.status(503).json({ success: false, statusCode: 503, message: "SMS verification is not available right now." });
  }
  next();
};

router.post(
  "/login",
  authRateLimitMiddleware,
  [
    body("identifier")
      .notEmpty()
      .withMessage("Phone number is required"),
    body("password").isLength({ min: 6 }),
  ],
  validateRequest,
  authController.login,
);

router.post(
  "/signup",
  authRateLimitMiddleware,
  [
    body("email").optional().isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").trim().notEmpty(),
    body("dateOfBirth").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Enter your date of birth"),
    body("emergencyName").optional({ values: "falsy" }).isString(),
    body("emergencyPhone").optional({ values: "falsy" }).isString(),
    body("emergencyRelation").optional({ values: "falsy" }).isString(),
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .matches(/^9\d{9}$/)
      .withMessage("Enter a 10-digit mobile number starting with 9"),
  ],
  optionalAuthMiddleware,
  validateRequest,
  authController.signup,
);

router.post(
  "/refresh",
  [body("refreshToken").notEmpty()],
  validateRequest,
  authController.refreshToken,
);

router.post("/logout", authController.logout);

router.post("/verify-otp", needsOtp, authController.verifyOTP);
router.post("/resend-otp", needsOtp, authController.resendOTP);
router.post(
  "/check-phone",
  [
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone("any"),
  ],
  validateRequest,
  authController.checkPhone
);

router.post(
  "/forgot-password",
  needsOtp,
  authRateLimitMiddleware,
  [
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone("any"),
  ],
  validateRequest,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  needsOtp,
  authRateLimitMiddleware,
  [
    body("phoneNumber").notEmpty(),
    body("otp").isLength({ min: 6, max: 6 }),
    body("newPassword").isLength({ min: 6 }),
  ],
  validateRequest,
  authController.resetPassword,
);

router.get("/me", authMiddleware, authController.me);
router.patch("/me", authMiddleware, authController.updateMe);
// the friend registered through Refer & Earn replaces the shared first password (no old password needed)
router.patch("/set-new-password", authMiddleware, [body("newPassword").isLength({ min: 6 }).withMessage("Use at least 6 characters")], validateRequest, authController.setNewPassword);
router.patch(
  "/change-password",
  authMiddleware,
  [
    body("currentPassword").isString().notEmpty().withMessage("Enter your current password"),
    body("newPassword").isLength({ min: 6 }),
  ],
  validateRequest,
  authController.changePassword,
);

export default router;
