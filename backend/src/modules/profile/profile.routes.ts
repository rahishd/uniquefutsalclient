import { Router, Response } from "express";
import { cleanEmergency } from "../../utils/emergency";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";
import { ageOn, isValidDob, MAX_AGE, MIN_AGE } from "../../utils/age";
import { codeKey, ensurePaymentCodes } from "../verify/verify.codes";
import sharp from "sharp";

const router = Router();
router.use(authMiddleware); // everything here is about the signed-in customer only

const POSITIONS = ["GK", "DEF", "MID", "FWD"];
const LANGUAGES = ["en", "ne"];

async function prefsFor(userId: string) {
  return prisma.userPrefs.upsert({ where: { userId }, update: {}, create: { userId } });
}

// ---- profile picture ----
// The picture is decoded for real, turned into a 480 x 480 square WebP (location data is dropped) and kept in the database
// like the site pictures, so no outside storage is needed. A new picture gets a new id, so old copies never show from cache.
const AVATAR_DATA_URL = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i;
const AVATAR_MAX_BYTES = 6 * 1024 * 1024;
const AVATAR_PATH = "/api/content/media/";
const ownMediaId = (avatar: string | null) => (avatar && avatar.startsWith(AVATAR_PATH) ? avatar.slice(AVATAR_PATH.length) : null);

router.put(
  "/profile/avatar",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const m = AVATAR_DATA_URL.exec(String((req.body as { image?: unknown })?.image ?? "").trim());
    if (!m) throw new AppError(400, "The picture must be a JPG, PNG or WebP image.");
    const raw = Buffer.from(m[1], "base64");
    if (raw.length === 0 || raw.length > AVATAR_MAX_BYTES) throw new AppError(400, "That picture is too large. The limit is 6 MB.");
    let out: { data: Buffer; width: number; height: number };
    try {
      const r = await sharp(raw, { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width: 480, height: 480, fit: "cover", position: "attention" })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      out = { data: r.data, width: r.info.width, height: r.info.height };
    } catch {
      throw new AppError(400, "That picture could not be read. Please choose a different image.");
    }
    const user = await prisma.user.findUnique({ where: { phoneNumber: id }, select: { avatar: true } });
    if (!user) throw new AppError(404, "User not found");
    const media = await prisma.contentMedia.create({ data: { mime: "image/webp", data: out.data, width: out.width, height: out.height, bytes: out.data.length, createdBy: id } });
    const avatar = `${AVATAR_PATH}${media.id}`;
    await prisma.user.update({ where: { phoneNumber: id }, data: { avatar } });
    const old = ownMediaId(user.avatar);
    if (old) await prisma.contentMedia.deleteMany({ where: { id: old, createdBy: id } });
    res.json(ApiResponseUtil.success(200, "Profile picture saved", { avatar }));
  }),
);

router.delete(
  "/profile/avatar",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const user = await prisma.user.findUnique({ where: { phoneNumber: id }, select: { avatar: true } });
    if (!user) throw new AppError(404, "User not found");
    await prisma.user.update({ where: { phoneNumber: id }, data: { avatar: null } });
    const old = ownMediaId(user.avatar);
    if (old) await prisma.contentMedia.deleteMany({ where: { id: old, createdBy: id } });
    res.json(ApiResponseUtil.success(200, "Profile picture removed", { avatar: null }));
  }),
);

// "UF-C-" + the last five digits of the mobile number. For display only; the phone number is the real identity.
const customerCode = (phone: string) => `UF-C-${phone.slice(-5)}`;

router.get(
  "/profile",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({ where: { phoneNumber: req.user!.id } });
    if (!user) throw new AppError(404, "User not found");
    const p = await prefsFor(user.phoneNumber);
    const vip = (await prisma.vipCode.count({ where: { userId: user.phoneNumber, active: true } })) > 0; // staff gave this customer a VIP code
    res.json(
      ApiResponseUtil.success(200, "Profile", {
        vip,
        customerCode: customerCode(user.phoneNumber),
        name: user.name ?? "",
        phone: user.phoneNumber,
        email: user.email,
        avatar: user.avatar,
        dateOfBirth: user.dateOfBirth,
        age: user.dateOfBirth ? ageOn(user.dateOfBirth, todayKey()) : null,
        emergencyName: user.emergencyName,
        emergencyPhone: user.emergencyPhone,
        emergencyRelation: user.emergencyRelation,
        location: p.location,
        position: p.position,
        registeredAt: user.createdAt,
        status: user.isActive ? "Active" : "Suspended",
        mode: p.mode,
      }),
    );
  }),
);

router.patch(
  "/profile",
  [
    body("name").optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage("Name must be at least 2 characters"),
    body("email").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("Enter a valid email").normalizeEmail(),
    body("location").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
    body("position").optional({ nullable: true, checkFalsy: true }).isIn(POSITIONS).withMessage("Position must be GK, DEF, MID or FWD"),
    body("dateOfBirth").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Enter a valid date of birth"),
    body("emergencyName").optional({ values: "null" }).isString(),
    body("emergencyPhone").optional({ values: "null" }).isString(),
    body("emergencyRelation").optional({ values: "null" }).isString(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const { name, email, location, position, dateOfBirth } = req.body;
    // The emergency contact is changed as a whole (name and number together) and can never be removed, only replaced.
    const emergency = req.body.emergencyPhone !== undefined || req.body.emergencyName !== undefined ? cleanEmergency(req.body, id) : null;
    if (email) {
      const taken = await prisma.user.findFirst({ where: { email, NOT: { phoneNumber: id } }, select: { phoneNumber: true } });
      if (taken) throw new AppError(409, "This email is already used by another account");
    }
    // The date of birth decides which age-group games a customer sees, so it is set once here (customers who signed up
    // before it was asked can add it); changing it later is for venue staff.
    if (dateOfBirth) {
      const current = await prisma.user.findUnique({ where: { phoneNumber: id }, select: { dateOfBirth: true } });
      if (current?.dateOfBirth && current.dateOfBirth !== dateOfBirth) throw new AppError(409, "Your date of birth is already saved. Please contact the venue to change it.");
      if (!isValidDob(dateOfBirth, todayKey())) throw new AppError(400, `Enter a real date of birth (age ${MIN_AGE} to ${MAX_AGE}).`);
    }
    // The mobile number is the account's identity and is never changed here.
    await prisma.user.update({
      where: { phoneNumber: id },
      data: { ...(name !== undefined && { name }), ...(email !== undefined && { email: email || null }), ...(dateOfBirth && { dateOfBirth }), ...emergency },
    });
    await prisma.userPrefs.upsert({
      where: { userId: id },
      update: { ...(location !== undefined && { location: location || null }), ...(position !== undefined && { position: position || null }) },
      create: { userId: id, location: location || null, position: position || null },
    });
    res.json(ApiResponseUtil.success(200, "Profile updated"));
  }),
);

router.get(
  "/preferences",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const p = await prefsFor(req.user!.id);
    res.json(ApiResponseUtil.success(200, "Preferences", { smsReminders: p.smsReminders, promoNotifications: p.promoNotifications, popupReminder: p.popupReminder, language: p.language }));
  }),
);

router.put(
  "/preferences",
  [
    body("smsReminders").optional().isBoolean().toBoolean(),
    body("promoNotifications").optional().isBoolean().toBoolean(),
    body("popupReminder").optional().isBoolean().toBoolean(),
    body("language").optional().isIn(LANGUAGES).withMessage("Language must be en or ne"),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { smsReminders, promoNotifications, popupReminder, language } = req.body;
    const data = {
      ...(smsReminders !== undefined && { smsReminders }),
      ...(promoNotifications !== undefined && { promoNotifications }),
      ...(popupReminder !== undefined && { popupReminder }),
      ...(language !== undefined && { language }),
    };
    const p = await prisma.userPrefs.upsert({ where: { userId: req.user!.id }, update: data, create: { userId: req.user!.id, ...data } });
    res.json(ApiResponseUtil.success(200, "Preferences saved", { smsReminders: p.smsReminders, promoNotifications: p.promoNotifications, popupReminder: p.popupReminder, language: p.language }));
  }),
);

// Player / Captain switch
router.put(
  "/mode",
  [body("mode").isIn(["player", "captain"]).withMessage("Mode must be player or captain")],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const p = await prisma.userPrefs.upsert({ where: { userId: req.user!.id }, update: { mode: req.body.mode }, create: { userId: req.user!.id, mode: req.body.mode } });
    res.json(ApiResponseUtil.success(200, "Mode saved", { mode: p.mode }));
  }),
);

// Web Push subscription of this device (closed-app reminders need these; sending them is a later step)
router.post(
  "/push-subscriptions",
  [body("endpoint").isURL({ require_tld: false }), body("keys.p256dh").isString().notEmpty(), body("keys.auth").isString().notEmpty()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { endpoint, keys } = req.body;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user!.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.user!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: (req.headers["user-agent"] as string | undefined) ?? null },
    });
    res.status(201).json(ApiResponseUtil.success(201, "Subscribed"));
  }),
);

router.delete(
  "/push-subscriptions",
  [body("endpoint").isString().notEmpty()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint, userId: req.user!.id } });
    res.json(ApiResponseUtil.success(200, "Unsubscribed"));
  }),
);

// Gameplay: games played (completed bookings) with goals and assists where staff recorded them. Older games have no
// numbers (they were never recorded), so they show as null and are not counted in the totals.
router.get(
  "/gameplay",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const stats = await prisma.playerGameStat.findMany({ where: { userId: id } });
    const byBooking = new Map(stats.map((s) => [s.bookingId, s]));
    const bookings = await prisma.booking.findMany({
      where: { status: { not: "cancelled" }, OR: [{ userId: id, status: "completed" }, { id: { in: stats.map((s) => s.bookingId) } }] },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 500,
    });
    const games = bookings.map((b) => {
      const s = byBooking.get(b.id);
      return { id: b.id, code: b.code || "UF-" + b.id.slice(-6).toUpperCase(), date: b.date, time: `${b.startTime} - ${b.endTime}`, goals: s ? s.goals : null, assists: s ? s.assists : null };
    });
    res.json(ApiResponseUtil.success(200, "Gameplay", {
      totals: { games: games.length, goals: stats.reduce((n, s) => n + s.goals, 0), assists: stats.reduce((n, s) => n + s.assists, 0), withStats: stats.length },
      games,
    }));
  }),
);

// Payment history: paid bookings and Gamezone sessions, newest first. Pay-at-venue bookings appear once paid.
router.get(
  "/payments",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const [bookingsAll, gz, bills] = await Promise.all([
      prisma.booking.findMany({ where: { userId: id, paymentStatus: "completed", totalPrice: { gt: 0 } }, orderBy: { date: "desc" }, take: 200 }),
      prisma.gzBooking.findMany({ where: { userId: id, paymentStatus: "paid" }, orderBy: { date: "desc" }, take: 200 }),
      prisma.checkout.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    // A game paid inside a final bill is shown in that bill, not twice
    const inBills = new Set(bills.flatMap((b) => b.bookingIds));
    const bookings = bookingsAll.filter((b) => !inBills.has(b.id));
    // every receipt carries a verification code (anyone can check it on the Verify page)
    const codes = await ensurePaymentCodes([
      ...bills.map((b) => ({ sourceType: "checkout" as const, sourceId: b.id })),
      ...bookings.map((b) => ({ sourceType: "booking" as const, sourceId: b.id })),
      ...gz.map((g) => ({ sourceType: "gamezone" as const, sourceId: g.code })),
    ]);
    const billItems = bills.map((b) => ({
      id: b.id, code: b.code, verifyCode: codes.get(codeKey("checkout", b.id)) ?? null, kind: "bill", date: todayKey(b.createdAt), time: "", amount: b.total, method: b.paymentMethod, status: "Paid",
      lines: JSON.parse(b.lines) as unknown, points: Number(b.pointsGoods) + Number(b.pointsGames),
    }));
    const items = [
      ...billItems,
      ...bookings.map((b) => ({ id: b.id, code: b.code || "UF-" + b.id.slice(-6).toUpperCase(), verifyCode: codes.get(codeKey("booking", b.id)) ?? null, kind: "game", date: b.date, time: `${b.startTime} - ${b.endTime}`, amount: b.totalPrice, method: b.paymentMethod, status: "Paid" })),
      ...gz.map((g) => ({ id: g.code, code: g.code, verifyCode: codes.get(codeKey("gamezone", g.code)) ?? null, kind: "gamezone", date: g.date, time: `${String(g.startHour).padStart(2, "0")}:00 - ${String(g.startHour + g.hours).padStart(2, "0")}:00`, amount: g.total, method: g.paymentMethod, status: "Paid" })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    res.json(ApiResponseUtil.success(200, "Payments", items));
  }),
);

export default router;
