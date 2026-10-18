import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { MAX_PHOTOS } from "../../utils/complaintMedia";
import { AuditService } from "../audit";
import insuranceService, { AMBULANCE, DAYS_BACK, DESCRIPTION_MAX, PER_DAY, SEVERITIES } from "./insurance.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

/* ---------- /api/insurance ---------- */
export const insuranceRouter = Router();

// What the form needs (public, so the page can render before sign-in)
insuranceRouter.get("/options", (_req, res: Response) => {
  ok(res, "Insurance claim options", { severities: SEVERITIES, maxPhotos: MAX_PHOTOS, descriptionMax: DESCRIPTION_MAX, daysBack: DAYS_BACK, perDay: PER_DAY, ambulance: AMBULANCE });
});

// Staff views, declared before anything with an :id
insuranceRouter.get("/admin", ...adminOnly, asyncHandler(async (req, res: Response) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  ok(res, "Insurance claims", await insuranceService.adminList(typeof req.query.status === "string" ? req.query.status : undefined, page, limit));
}));

insuranceRouter.patch(
  "/admin/:id",
  ...adminOnly,
  [body("status").optional().isString(), body("reply").optional().isString()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const r = await insuranceService.adminUpdate(req.user!.id, req.params.id, { status: req.body.status, reply: req.body.reply });
    await AuditService.log({ action: "INSURANCE_CLAIM_UPDATED", entity: "InsuranceClaim", entityId: req.params.id, changes: `${req.body.status ?? ""}${req.body.reply ? " + reply" : ""}`.trim(), userId: req.user!.id });
    ok(res, "Claim updated", r);
  }),
);

// A signed-in customer
insuranceRouter.get("/me", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "My insurance claims", await insuranceService.mine(req.user!.id));
}));

insuranceRouter.post(
  "/emergency-contact",
  authMiddleware,
  [body("patientPhone").isString()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const r = await insuranceService.emergencyContact(req.user!.id, req.body.patientPhone);
    await AuditService.log({ action: "EMERGENCY_CONTACT_LOOKUP", entity: "User", entityId: req.body.patientPhone, changes: r.contact ? "found" : "none saved", userId: req.user!.id });
    ok(res, "Emergency contact", r);
  }),
);

insuranceRouter.post(
  "/",
  authMiddleware,
  [
    body("patientName").isString(), body("patientPhone").isString(), body("witnessName").isString(), body("witnessNameNe").isString(),
    body("witnessPhone").optional({ values: "falsy" }).isString(), body("severity").isString(), body("incidentDate").isString(),
    body("description").optional({ values: "null" }).isString(), body("photos").isArray(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    ok(res, "Claim received", await insuranceService.create(req.user!.id, req.body), 201);
  }),
);
