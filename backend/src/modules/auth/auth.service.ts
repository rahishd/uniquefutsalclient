import { prisma } from "../../config/db";
import { cleanEmergency } from "../../utils/emergency";
import { HashUtil } from "../../utils/hash";
import { JwtUtil } from "../../utils/jwt";
import { AppError } from "../../middlewares/error.middleware";
import {
  LoginDTO,
  SignupDTO,
  AuthResponse,
  MeResponse,
  UpdateMeDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
} from "./auth.dto";
import logger from "../../config/logger";
import { uploadBase64ToR2 } from "../../utils/r2storage";
import smsService from "../../services/sms.service";
import crypto from "crypto";
import env from "../../config/env";
import { isValidDob, MAX_AGE, MIN_AGE } from "../../utils/age";
import { todayKey } from "../../utils/dates";
import { SUSPENDED_MESSAGE } from "../../middlewares/auth.middleware";

const RETRYABLE_DB_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const RETRYABLE_DB_ERROR_PATTERN =
  /Can't reach database server|Connection terminated unexpectedly|ECONNRESET|ETIMEDOUT/i;

const isRetryableDbError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; message?: unknown };
  if (
    typeof candidate.code === "string" &&
    RETRYABLE_DB_ERROR_CODES.has(candidate.code)
  ) {
    return true;
  }

  return (
    typeof candidate.message === "string" &&
    RETRYABLE_DB_ERROR_PATTERN.test(candidate.message)
  );
};

export class AuthService {
  /** Counts a sign-in (the app stops showing "New" tags after a few). Never blocks signing in. */
  private async recordLogin(phoneNumber: string): Promise<void> {
    try {
      await prisma.user.update({ where: { phoneNumber }, data: { loginCount: { increment: 1 } } });
    } catch (e) {
      logger.warn(`Could not count the sign-in of ${phoneNumber}: ${(e as Error).message}`);
    }
  }

  /**
   * A friend registered through Refer & Earn signs in with the shared first password: the referrer and the friend each get
   * the sign-up points (once, ever), and the app must now ask for a new password. Returns true while the new one is still owed.
   */
  private async friendFirstLogin(user: { phoneNumber: string; name: string | null; mustChangePassword: boolean; referredBy: string | null; referralBonusAt: Date | null }): Promise<boolean> {
    if (!user.mustChangePassword) return false;
    if (user.referredBy && !user.referralBonusAt) {
      const claimed = await prisma.user.updateMany({ where: { phoneNumber: user.phoneNumber, referralBonusAt: null }, data: { referralBonusAt: new Date() } });
      if (claimed.count === 1) {
        try {
          const { default: loyaltyService } = await import("../loyalty/loyalty.service");
          const { FRIEND_SIGNUP_POINTS } = await import("../refer/refer.service");
          await loyaltyService.award({ userId: user.referredBy, kind: "referral", points: FRIEND_SIGNUP_POINTS, sourceType: "friend-signup", sourceId: `${user.phoneNumber}:referrer`, detail: `Refer & Earn: ${user.name ?? "your friend"} signed in to Unique Futsal` });
          await loyaltyService.award({ userId: user.phoneNumber, kind: "referral", points: FRIEND_SIGNUP_POINTS, sourceType: "friend-signup", sourceId: `${user.phoneNumber}:friend`, detail: "Welcome bonus: a friend registered you" });
        } catch (e) {
          logger.error(`Friend sign-up points failed for ${user.phoneNumber}: ${(e as Error).message}`);
        }
      }
    }
    return true;
  }

  /** The friend replaces the shared first password. Only allowed while it is still owed (no old password needed: they just used it). */
  async setInitialPassword(userId: string, newPassword: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId } });
    if (!user) throw new AppError(404, "User not found");
    if (!user.mustChangePassword) throw new AppError(409, "Your password is already set. Use Change password in Settings.");
    if (await HashUtil.compare(newPassword, user.password)) throw new AppError(400, "Choose a different password from the one you were given.");
    await prisma.user.update({ where: { phoneNumber: userId }, data: { password: await HashUtil.hash(newPassword), mustChangePassword: false } });
    logger.info(`User ${userId} replaced the shared first password.`);
    return true;
  }

  /** Signs in a customer who proved who they are another way (Face ID / fingerprint). Same checks and result as the password login. */
  async loginWithPasskey(phoneNumber: string): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || user.role !== "user") throw new AppError(401, "Face ID sign-in failed. Use your password.");
    if (!user.isActive) throw new AppError(403, SUSPENDED_MESSAGE);
    await this.recordLogin(user.phoneNumber);
    const claims = { id: user.phoneNumber, email: user.email, role: user.role || "user" };
    return {
      token: JwtUtil.sign(claims),
      refreshToken: JwtUtil.signRefresh(claims),
      user: {
        id: user.phoneNumber,
        email: user.email,
        name: user.name || "",
        phoneNumber: user.phoneNumber,
        role: user.role || "user",
        avatar: user.avatar || undefined,
        freeMatchesAvailable: user.freeMatchesAvailable,
      },
    };
  }

  async login(dto: LoginDTO): Promise<AuthResponse> {
    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: dto.identifier,
      },
    });

    if (!user) {
      throw new AppError(401, "Invalid phone number or password");
    }

    const isValidPassword = await HashUtil.compare(dto.password, user.password);
    if (!isValidPassword) {
      throw new AppError(401, "Invalid phone number or password");
    }

    if (!user.isActive) throw new AppError(403, SUSPENDED_MESSAGE);

    if (!user.isVerified && env.OTP_ENABLED) {
      // Automatically resend OTP if they try to login while unverified
      await this.resendOTP(user.phoneNumber);
      throw new AppError(403, "Account not verified. A new verification code has been sent to your phone.");
    }

    if (!user.phoneNumber) {
      throw new AppError(500, "User phone number is not configured");
    }

    await this.recordLogin(user.phoneNumber);
    const mustChangePassword = await this.friendFirstLogin(user);

    const token = JwtUtil.sign({
      id: user.phoneNumber,
      email: user.email,
      role: user.role || "user",
    });

    const refreshToken = JwtUtil.signRefresh({
      id: user.phoneNumber,
      email: user.email,
      role: user.role || "user",
    });

    return {
      token,
      refreshToken,
      user: {
        id: user.phoneNumber,
        email: user.email,
        name: user.name || "",
        phoneNumber: user.phoneNumber,
        role: user.role || "user",
        avatar: user.avatar || undefined,
        freeMatchesAvailable: user.freeMatchesAvailable,
        mustChangePassword,
      },
    };
  }

  async signup(
    dto: SignupDTO,
    isAdmin: boolean = false,
  ): Promise<AuthResponse> {
    const [existingUser, existingPending] = await Promise.all([
      prisma.user.findFirst({ where: { phoneNumber: dto.phoneNumber } }),
      prisma.pendingSignup.findUnique({
        where: { phoneNumber: dto.phoneNumber },
      }),
    ]);

    if (existingUser) {
      if (existingUser.isVerified) {
        throw new AppError(409, "This phone number is already registered. Please login instead.");
      } else {
        // Unverified account (for example created by staff for a guest): do not delete it. Only a user with no
        // records may be replaced; anything else keeps its data and the person must contact the venue.
        const records = await prisma.booking.count({ where: { userId: dto.phoneNumber } });
        if (records > 0 || existingUser.freeMatchesAvailable > 0) {
          throw new AppError(409, "This phone number already has an account with records. Please contact the venue.");
        }
        await prisma.user.delete({ where: { phoneNumber: dto.phoneNumber } });
      }
    }

    // A customer signing up must give a real date of birth (it decides which age-group games they see). Staff may add one later.
    if (!isAdmin && !isValidDob(dto.dateOfBirth, todayKey())) {
      throw new AppError(400, `Enter your date of birth (age ${MIN_AGE} to ${MAX_AGE}).`);
    }
    const dateOfBirth = isValidDob(dto.dateOfBirth, todayKey()) ? dto.dateOfBirth : null;
    // A customer must also give an emergency contact (who to call if they are hurt at the venue). Staff may add it later.
    const emergency = !isAdmin || dto.emergencyPhone ? cleanEmergency(dto, dto.phoneNumber) : null;

    const hashedPassword = await HashUtil.hash(dto.password);

    if (isAdmin) {
      // Direct registration for admins
      const user = await prisma.user.create({
        data: {
          phoneNumber: dto.phoneNumber,
          name: dto.name,
          email: dto.email || null,
          password: hashedPassword,
          dateOfBirth,
          ...emergency,
          isVerified: true,
          role: "user",
        },
      });

      // Clean up pending signup if it exists
      if (existingPending) {
        await prisma.pendingSignup.delete({
          where: { phoneNumber: dto.phoneNumber },
        });
      }

      logger.info(
        `User ${user.phoneNumber} created directly by admin (verified).`,
      );

      return {
        token: "",
        refreshToken: "",
        user: {
          id: user.phoneNumber,
          email: user.email,
          name: user.name || "",
          phoneNumber: user.phoneNumber,
          role: user.role || "user",
          isVerified: true,
        },
      };
    }

    if (!env.OTP_ENABLED) {
      // OTP / SMS verification is OFF: sign up with phone + password only. The phone number is NOT proven yet,
      // so an existing record for that number is never taken over, and history from earlier guest bookings is
      // never attached to the new account automatically.
      if (existingUser) {
        throw new AppError(409, "This phone number is already registered. Please login or ask the venue to help you.");
      }
      const created = await prisma.user.create({
        data: {
          phoneNumber: dto.phoneNumber,
          name: dto.name,
          email: dto.email || null,
          password: hashedPassword,
          dateOfBirth,
          ...emergency,
          isVerified: true,
          role: "user",
        },
      });
      logger.info(`User ${created.phoneNumber} registered (OTP off).`);
      await this.recordLogin(created.phoneNumber);
      const token = JwtUtil.sign({ id: created.phoneNumber, email: created.email || undefined, role: "user" });
      const refreshToken = JwtUtil.signRefresh({ id: created.phoneNumber, email: created.email || undefined, role: "user" });
      return {
        token,
        refreshToken,
        user: { id: created.phoneNumber, email: created.email, name: created.name || "", phoneNumber: created.phoneNumber, role: "user", freeMatchesAvailable: created.freeMatchesAvailable, isVerified: true },
      };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save to PendingSignup
    const pending = await prisma.pendingSignup.upsert({
      where: { phoneNumber: dto.phoneNumber },
      update: {
        name: dto.name,
        email: dto.email || null,
        password: hashedPassword,
        dateOfBirth,
        ...emergency,
        otp,
        expiresAt,
        createdAt: new Date(),
      },
      create: {
        phoneNumber: dto.phoneNumber,
        name: dto.name,
        email: dto.email || null,
        password: hashedPassword,
        dateOfBirth,
        ...emergency,
        otp,
        expiresAt,
      },
    });

    // Send SMS
    const smsSent = await smsService.send({
      phoneNumber: dto.phoneNumber,
      message: `Your Unique Futsal verification code is: ${otp}. Valid for 10 minutes.`,
    });

    if (!smsSent) {
      logger.error(`Failed to send OTP to ${dto.phoneNumber}`);
    }

    const logMessage =
      process.env.NODE_ENV === "development"
        ? `New pending signup created: ${dto.phoneNumber}. OTP: ${otp} (Dev Mode)`
        : `New pending signup created: ${dto.phoneNumber}. OTP sent.`;
    logger.info(logMessage);

    return {
      token: "",
      refreshToken: "",
      user: {
        id: dto.phoneNumber,
        email: dto.email || null,
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        role: "user",
        isVerified: false,
      },
    };
  }

  async verifyOTP(phoneNumber: string, otp: string): Promise<AuthResponse> {
    const pending = await prisma.pendingSignup.findUnique({
      where: { phoneNumber },
    });

    if (pending) {
      if (pending.otp !== otp) {
        throw new AppError(401, "Invalid verification code");
      }

      if (new Date() > pending.expiresAt) {
        throw new AppError(401, "Verification code has expired");
      }

      // Create or update real user now that OTP is verified
      const user = await prisma.user.upsert({
        where: { phoneNumber: pending.phoneNumber },
        update: {
          name: pending.name,
          email: pending.email,
          password: pending.password,
          ...(pending.dateOfBirth ? { dateOfBirth: pending.dateOfBirth } : {}),
          ...(pending.emergencyPhone ? { emergencyName: pending.emergencyName, emergencyPhone: pending.emergencyPhone, emergencyRelation: pending.emergencyRelation } : {}),
          isVerified: true,
        },
        create: {
          phoneNumber: pending.phoneNumber,
          name: pending.name,
          email: pending.email,
          password: pending.password,
          dateOfBirth: pending.dateOfBirth,
          emergencyName: pending.emergencyName,
          emergencyPhone: pending.emergencyPhone,
          emergencyRelation: pending.emergencyRelation,
          isVerified: true,
          role: "user",
        },
      });

      // Clean up pending signup
      await prisma.pendingSignup.delete({ where: { phoneNumber } });

      // Generate tokens
      await this.recordLogin(user.phoneNumber);

      const token = JwtUtil.sign({
        id: user.phoneNumber,
        email: user.email || undefined,
        role: user.role || "user",
      });

      const refreshToken = JwtUtil.signRefresh({
        id: user.phoneNumber,
        email: user.email || undefined,
        role: user.role || "user",
      });

      logger.info(`User ${user.phoneNumber} created and verified successfully`);

      return {
        token,
        refreshToken,
        user: {
          id: user.phoneNumber,
          email: user.email,
          name: user.name || "",
          phoneNumber: user.phoneNumber,
          role: user.role || "user",
          avatar: user.avatar || undefined,
          freeMatchesAvailable: user.freeMatchesAvailable,
        },
      };
    }

    // Fallback for old unverified users (if any exist)
    const userOtp = await prisma.userOTP.findUnique({
      where: { phoneNumber },
    });

    if (!userOtp || userOtp.otp !== otp) {
      throw new AppError(401, "Invalid verification code");
    }

    if (new Date() > userOtp.expiresAt) {
      throw new AppError(401, "Verification code has expired");
    }

    // Mark user as verified
    const user = await prisma.user.update({
      where: { phoneNumber },
      data: { isVerified: true },
    });

    // Clean up OTP
    await prisma.userOTP.delete({ where: { phoneNumber } });

    // Generate tokens now that user is verified
    await this.recordLogin(user.phoneNumber);

    const token = JwtUtil.sign({
      id: user.phoneNumber,
      email: user.email || undefined,
      role: user.role || "user",
    });

    const refreshToken = JwtUtil.signRefresh({
      id: user.phoneNumber,
      email: user.email || undefined,
      role: user.role || "user",
    });

    logger.info(`User ${user.phoneNumber} verified successfully`);

    return {
      token,
      refreshToken,
      user: {
        id: user.phoneNumber,
        email: user.email,
        name: user.name || "",
        phoneNumber: user.phoneNumber,
        role: user.role || "user",
        avatar: user.avatar || undefined,
        freeMatchesAvailable: user.freeMatchesAvailable,
      },
    };
  }

  async resendOTP(phoneNumber: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    const pending = await prisma.pendingSignup.findUnique({
      where: { phoneNumber },
    });

    if (!user && !pending) {
      throw new AppError(404, "User not found");
    }

    if (user && user.isVerified) {
      throw new AppError(400, "User is already verified");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (pending) {
      await prisma.pendingSignup.update({
        where: { phoneNumber },
        data: { otp, expiresAt, createdAt: new Date() },
      });
    } else {
      await prisma.userOTP.upsert({
        where: { phoneNumber },
        update: { otp, expiresAt, createdAt: new Date() },
        create: { phoneNumber, otp, expiresAt },
      });
    }

    const smsSent = await smsService.send({
      phoneNumber,
      message: `Your new Unique Futsal verification code is: ${otp}. Valid for 10 minutes.`,
    });

    if (process.env.NODE_ENV === 'development') {
      logger.info(`OTP Resent for ${phoneNumber}: ${otp} (Dev Mode)`);
    }

    return smsSent;
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const decoded = JwtUtil.verifyRefresh(refreshToken);

    const user = await prisma.user.findFirst({
      where: { phoneNumber: decoded.id },
    });

    if (!user) {
      throw new AppError(401, "User not found");
    }
    if (!user.isActive) throw new AppError(403, SUSPENDED_MESSAGE);

    if (!user.phoneNumber) {
      throw new AppError(500, "User phone number is not configured");
    }

    const newToken = JwtUtil.sign({
      id: user.phoneNumber,
      email: user.email,
      role: user.role || "user",
    });

    const newRefreshToken = JwtUtil.signRefresh({
      id: user.phoneNumber,
      email: user.email,
      role: user.role || "user",
    });

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.phoneNumber,
        email: user.email,
        name: user.name || "",
        phoneNumber: user.phoneNumber,
        role: user.role || "user",
        avatar: user.avatar || undefined,
        freeMatchesAvailable: user.freeMatchesAvailable,
      },
    };
  }

  async checkPhone(phoneNumber: string): Promise<{ exists: boolean; name?: string; email?: string; isVerified: boolean }> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      select: {
        name: true,
        email: true,
        isVerified: true,
      },
    });

    if (user) {
      // Only say that the account exists. Names and emails of other people are never returned to the public.
      return { exists: true, isVerified: user.isVerified };
    }

    return { exists: false, isVerified: false };
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await prisma.user.findFirst({
      where: { phoneNumber: userId },
      select: {
        email: true,
        name: true,
        phoneNumber: true,
        role: true,
        avatar: true,
        freeMatchesAvailable: true,
        loginCount: true,
        emergencyPhone: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.phoneNumber) {
      throw new AppError(500, "User phone number is not configured");
    }

    return {
      id: user.phoneNumber,
      email: user.email,
      name: user.name || "",
      phoneNumber: user.phoneNumber,
      role: user.role,
      avatar: user.avatar || undefined,
      freeMatchesAvailable: user.freeMatchesAvailable,
      loginCount: user.loginCount,
      hasEmergencyContact: !!user.emergencyPhone,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDTO): Promise<MeResponse> {
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;

    if (dto.avatar !== undefined) {
      if (dto.avatar === "") {
        // Explicitly clearing the avatar
        updateData.avatar = null;
      } else if (dto.avatar.startsWith("data:")) {
        // It's a base64 data URL — upload to Cloudflare R2
        try {
          const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
          const key = `avatars/${sanitizedUserId}_${Date.now()}`;
          const publicUrl = await uploadBase64ToR2(dto.avatar, key);
          updateData.avatar = publicUrl;
          logger.info(`Avatar uploaded to R2 for user ${userId}: ${publicUrl}`);
        } catch (err) {
          logger.error(`R2 avatar upload failed for user ${userId}:`, err);
          throw new AppError(500, "Failed to upload avatar. Please try again.");
        }
      } else {
        // Already a URL (e.g. previously uploaded) — keep as-is
        updateData.avatar = dto.avatar;
      }
    }

    const performUpdate = () =>
      prisma.user.update({
        where: { phoneNumber: userId },
        data: updateData,
        select: {
          email: true,
          name: true,
          phoneNumber: true,
          role: true,
          avatar: true,
          freeMatchesAvailable: true,
        },
      });

    let user;
    try {
      user = await performUpdate();
    } catch (error) {
      if (!isRetryableDbError(error)) {
        throw error;
      }

      logger.warn(
        `Transient DB error while updating profile for user ${userId}. Retrying once.`,
      );
      user = await performUpdate();
    }

    return {
      id: user.phoneNumber,
      email: user.email,
      name: user.name || "",
      phoneNumber: user.phoneNumber,
      role: user.role,
      avatar: user.avatar || undefined,
    };
  }

  async forgotPassword(phoneNumber: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new AppError(404, "User not found with this phone number");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save to UserOTP
    await prisma.userOTP.upsert({
      where: { phoneNumber },
      update: { otp, expiresAt, createdAt: new Date() },
      create: { phoneNumber, otp, expiresAt },
    });

    // Send SMS
    const smsSent = await smsService.send({
      phoneNumber,
      message: `Your Unique Futsal password reset code is: ${otp}. Valid for 10 minutes.`,
    });

    if (process.env.NODE_ENV === "development") {
      logger.info(`Forgot Password OTP for ${phoneNumber}: ${otp} (Dev Mode)`);
    }

    return smsSent;
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<boolean> {
    const userOtp = await prisma.userOTP.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (!userOtp || userOtp.otp !== dto.otp) {
      throw new AppError(401, "Invalid reset code");
    }

    if (new Date() > userOtp.expiresAt) {
      throw new AppError(401, "Reset code has expired");
    }

    const hashedPassword = await HashUtil.hash(dto.newPassword);

    await prisma.user.update({
      where: { phoneNumber: dto.phoneNumber },
      data: { password: hashedPassword },
    });

    // Clean up OTP
    await prisma.userOTP.delete({ where: { phoneNumber: dto.phoneNumber } });

    logger.info(`Password reset successfully for user ${dto.phoneNumber}`);

    return true;
  }

  async changePassword(userId: string, dto: ChangePasswordDTO): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: userId },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    // A customer changing it themselves must prove the old one; staff set new ones from the admin portal.
    {
      const isValid = await HashUtil.compare(dto.currentPassword ?? "", user.password);
      if (!isValid) {
        throw new AppError(401, "Current password is incorrect");
      }
    }

    const hashedPassword = await HashUtil.hash(dto.newPassword);

    await prisma.user.update({
      where: { phoneNumber: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed successfully for user ${userId}`);

    return true;
  }
}

export default new AuthService();
