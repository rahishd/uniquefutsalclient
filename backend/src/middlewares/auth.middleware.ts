import { Request, Response, NextFunction } from "express";
import { JwtUtil } from "../utils/jwt";
import { ApiResponseUtil } from "../utils/apiResponse";
import { prisma } from "../config/db";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string | null;
    role: string;
  };
}

export const SUSPENDED_MESSAGE = "Your account is suspended, so you cannot do this. Please contact Unique Futsal.";
const suspended = (res: Response) => res.status(403).json({ success: false, statusCode: 403, code: "ACCOUNT_SUSPENDED", message: SUSPENDED_MESSAGE, timestamp: new Date().toISOString() });

// A suspended account (by the venue, or switched off by the customer) can do nothing, even with a sign-in that is still valid.
// The state is read from the database on every request, with a few seconds of memory so a busy page does not ask each time.
// (No memory in tests, and a suspension made in this process is applied at once.)
const TTL_MS = process.env.NODE_ENV === "test" ? 0 : 5000;
const seen = new Map<string, { active: boolean; at: number }>();
export const forgetAccountState = (id?: string) => (id ? seen.delete(id) : seen.clear());

export async function isAccountActive(id: string): Promise<boolean> {
  const hit = seen.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.active;
  const u = await prisma.user.findUnique({ where: { phoneNumber: id }, select: { isActive: true } });
  const active = u ? u.isActive : true; // an unknown id (an older admin token) is left to the route itself
  seen.set(id, { active, at: Date.now() });
  return active;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  let decoded;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json(ApiResponseUtil.error(401, "No token provided"));
    }

    decoded = JwtUtil.verify(token);
  } catch (error) {
    return res.status(401).json(ApiResponseUtil.error(401, "Invalid token"));
  }
  try {
    if (!(await isAccountActive(decoded.id))) return suspended(res);
  } catch (error) {
    return next(error);
  }
  req.user = decoded;
  next();
};

export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  let decoded;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      next();
      return;
    }

    decoded = JwtUtil.verify(token);
  } catch (_error) {
    next();
    return;
  }
  // a suspended person does not get to act as a guest either
  try {
    if (!(await isAccountActive(decoded.id))) return suspended(res);
  } catch (error) {
    return next(error);
  }
  req.user = decoded;
  next();
};

export default authMiddleware;
