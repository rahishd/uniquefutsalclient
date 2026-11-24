import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import { AuditService } from "../audit";
import paymentService from "./payment.service";

const router = Router();

// Polled by the payment screen. Owner (signed in) or the guest who made the order (?phone=).
router.get(
  "/:orderCode/status",
  optionalAuthMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const staff = req.user?.role === "admin" || req.user?.role === "superadmin";
    const result = await paymentService.status(req.params.orderCode, {
      userId: req.user?.id,
      phone: typeof req.query.phone === "string" ? req.query.phone : undefined,
      staff,
    });
    res.json(ApiResponseUtil.success(200, "Payment status", result));
  }),
);

// Staff: the customer paid the venue's Fonepay QR and staff saw it in the Fonepay app. This confirms the order.
router.post(
  "/:orderCode/mark-paid",
  ...adminOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await paymentService.markPaid(req.params.orderCode, { source: "staff", by: req.user!.id });
    await AuditService.log({ action: "PAYMENT_MARKED_PAID", entity: "PaymentOrder", entityId: req.params.orderCode, changes: "Marked paid by staff", userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Payment recorded", { alreadyPaid: result.alreadyPaid }));
  }),
);

export default router;
