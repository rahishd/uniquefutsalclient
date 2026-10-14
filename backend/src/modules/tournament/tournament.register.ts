import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";

// Team registration for ONE tournament, from a link that can be shared (the customer site: /tournaments/<id>/register).
// Open to guests as well: a captain only needs the team name, a mobile number and the player names. Contact details are
// never shown back to anyone except staff in the admin portal. The team registers as a whole: players are not listed one by
// one (a list may still be sent, for example by older apps, and is kept as given).
export const MAX_PLAYERS = 30;
const PHONE = /^9\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type T = { id: string; name: string; startDate: string; endDate: string; isActive: boolean; status: string; maxTeams: number; prizePool: number; entryFee: number; hostedEvent: boolean; hostName: string | null; description: string | null };

const counted = { status: { not: "rejected" } } as const;

// Is this tournament taking teams right now, and why not.
export async function registrationState(t: T) {
  const registered = await prisma.registration.count({ where: { tournamentId: t.id, ...counted } });
  const limit = t.maxTeams > 0 ? t.maxTeams : null;
  let closedReason: string | null = null;
  if (!t.isActive || t.status === "cancelled") closedReason = "Registration for this tournament is closed.";
  else if (t.status === "completed" || t.endDate < todayKey()) closedReason = "This tournament has finished.";
  else if (limit !== null && registered >= limit) closedReason = "All team places are taken.";
  return { registered, limit, spotsLeft: limit === null ? null : Math.max(0, limit - registered), open: closedReason === null, closedReason };
}

export interface TeamInput {
  teamName?: unknown;
  captainName?: unknown;
  contactPhone?: unknown;
  contactEmail?: unknown;
  players?: unknown;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Checks everything and saves the team as "pending". Used by the shareable link and by the older POST /registrations route.
export async function registerTeam(tournamentId: string, input: TeamInput) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new AppError(404, "Tournament not found");
  const state = await registrationState(t);
  if (!state.open) throw new AppError(409, state.closedReason ?? "Registration is closed.");

  const teamName = clean(input.teamName, 40);
  const captainName = clean(input.captainName, 60);
  const phone = clean(input.contactPhone, 15).replace(/\D/g, "");
  const email = clean(input.contactEmail, 120);
  if (teamName.length < 2) throw new AppError(400, "Enter the team name (at least 2 letters).");
  if (captainName.length < 2) throw new AppError(400, "Enter the captain's name.");
  if (!PHONE.test(phone)) throw new AppError(400, "Enter a 10-digit mobile number starting with 9.");
  if (email && !EMAIL.test(email)) throw new AppError(400, "Enter a valid email, or leave it empty.");
  const raw = Array.isArray(input.players) ? input.players : [];
  const players = raw.map((p) => clean(p, 40)).filter(Boolean).slice(0, MAX_PLAYERS);

  const clash = await prisma.registration.findFirst({
    where: { tournamentId, ...counted, OR: [{ teamName: { equals: teamName, mode: "insensitive" } }, { contactPhone: phone }] },
    select: { teamName: true, contactPhone: true },
  });
  if (clash) {
    throw new AppError(409, clash.contactPhone === phone ? "This mobile number has already registered a team for this tournament." : "A team with this name is already registered. Please use a different name.");
  }

  const row = await prisma.registration.create({
    data: { tournamentId, teamName, captainName, contactEmail: email, contactPhone: phone, players: JSON.stringify(players), status: "pending" },
  });

  // a customer with an account gets a notice in the app
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone }, select: { phoneNumber: true } });
  if (user) {
    await prisma.notification
      .create({ data: { userId: user.phoneNumber, type: "tournament", title: "Team registration received", message: `${teamName} is registered for ${t.name}. The venue will confirm it.`, href: "/tournaments", dedupeKey: `reg-${row.id}` } })
      .catch(() => undefined);
  }
  return { id: row.id, teamName: row.teamName, status: row.status, tournamentName: t.name };
}

const perHour = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  message: "Too many registrations from this connection. Please try again later.",
  skip: () => process.env.NODE_ENV !== "production",
});

const router = Router();

// What the registration page shows: the tournament and whether it is taking teams.
router.get(
  "/:id/registration",
  asyncHandler(async (req: Request, res: Response) => {
    const t = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!t || t.status === "cancelled") throw new AppError(404, "Tournament not found");
    const s = await registrationState(t);
    let format: string | undefined;
    try {
      format = (JSON.parse(t.description || "{}") as { format?: string }).format;
    } catch {
      /* description is free text for older tournaments */
    }
    res.json(
      ApiResponseUtil.success(200, "Registration", {
        id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, prizePool: t.prizePool, entryFee: t.entryFee, format,
        hosted: t.hostedEvent ? { hostName: t.hostName } : null,
        registered: s.registered, limit: s.limit, spotsLeft: s.spotsLeft, open: s.open, closedReason: s.closedReason,
      }),
    );
  }),
);

router.post(
  "/:id/register",
  perHour,
  asyncHandler(async (req: Request, res: Response) => {
    const r = await registerTeam(req.params.id, req.body as TeamInput);
    res.status(201).json(ApiResponseUtil.success(201, "Team registered. The venue will confirm it.", r));
  }),
);

export default router;
