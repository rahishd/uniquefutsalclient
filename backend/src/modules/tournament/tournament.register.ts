import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware";

// Team registration for ONE tournament, from a link that can be shared (the customer site: /tournaments/<id>/register).
// Needs a signed-in customer (a guest can only book a court or Gamezone): a captain gives the team name and a mobile number. Contact details are
// never shown back to anyone except staff in the admin portal. The team registers as a whole: players are not listed one by
// one (a list may still be sent, for example by older apps, and is kept as given).
export const MAX_PLAYERS = 30;
const PHONE = /^9\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type T = { id: string; name: string; startDate: string; endDate: string; isActive: boolean; status: string; maxTeams: number; registrationClosed?: boolean; prizePool: number; entryFee: number; hostedEvent: boolean; hostName: string | null; description: string | null };

// teams that hold a place: not declined by the host and not taken back by the customer
const counted = { status: { notIn: ["rejected", "cancelled"] } };

// Is this tournament taking teams right now, and why not.
export async function registrationState(t: T) {
  const registered = await prisma.registration.count({ where: { tournamentId: t.id, ...counted } });
  const limit = t.maxTeams > 0 ? t.maxTeams : null;
  let closedReason: string | null = null;
  if (!t.isActive || t.status === "cancelled") closedReason = "Registration for this tournament is closed.";
  else if (t.status === "completed" || t.endDate < todayKey()) closedReason = "This tournament has finished.";
  else if (t.registrationClosed) closedReason = "The organizer has closed registration for this tournament.";
  // once the first day has started, the team list is fixed: no sign-ups while the tournament runs
  else if (t.startDate <= todayKey()) closedReason = "Registration is closed because the tournament has started.";
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

  // the same name in any spelling: capitals, spaces and punctuation do not make a team different ("FC Tilottama" = "fc-tilottama")
  const same = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const others = await prisma.registration.findMany({ where: { tournamentId, ...counted }, select: { teamName: true, contactPhone: true } });
  if (others.some((o) => o.contactPhone === phone)) throw new AppError(409, "This mobile number has already registered a team for this tournament.");
  if (others.some((o) => same(o.teamName) === same(teamName))) throw new AppError(409, "This team name is already taken in this tournament. Please use a different name.");

  const row = await prisma.registration.create({
    data: { tournamentId, teamName, captainName, contactEmail: email, contactPhone: phone, players: JSON.stringify(players), status: "pending" },
  });

  // a customer with an account gets a notice in the app
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone }, select: { phoneNumber: true } });
  if (user) {
    await prisma.notification
      .create({ data: { userId: user.phoneNumber, type: "tournament", title: "Team registration received", message: `${teamName} is registered for ${t.name}. The tournament host will confirm it.`, href: "/tournaments", dedupeKey: `reg-${row.id}` } })
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

// The prize list the host wrote: place, cash, trophy or gift, note.
const prizesOf = (raw: unknown): { place: string; cash: number; trophy: string; note: string }[] =>
  Array.isArray(raw)
    ? raw.flatMap((p) => (p && typeof p === "object" ? [{ place: String((p as { place?: unknown }).place ?? ""), cash: Number((p as { cash?: unknown }).cash) || 0, trophy: String((p as { trophy?: unknown }).trophy ?? ""), note: String((p as { note?: unknown }).note ?? "") }] : [])).filter((p) => p.place)
    : [];

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
        id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, prizePool: t.prizePool, prizes: prizesOf(t.prizes), entryFee: t.entryFee, esewaNumber: t.esewaNumber ?? null, khaltiNumber: t.khaltiNumber ?? null, format,
        hosted: t.hostedEvent ? { hostName: t.hostName } : null,
        registered: s.registered, limit: s.limit, spotsLeft: s.spotsLeft, open: s.open, closedReason: s.closedReason,
      }),
    );
  }),
);

// Which tournaments the signed-in customer has registered a team in (matched on the captain's mobile number, which is the account number),
// so the app can show a "You registered" badge. Declined teams are left out.
router.get(
  "/my-registrations",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const phone = (req as AuthRequest).user!.id;
    const rows = await prisma.registration.findMany({ where: { contactPhone: phone, status: { notIn: ["rejected", "cancelled"] } }, select: { id: true, tournamentId: true, teamName: true, status: true, tournament: { select: { hostPhone: true } } }, orderBy: { createdAt: "desc" } });
    // the host's number is given only for a team the host has already confirmed: that is who to call to cancel
    res.json(ApiResponseUtil.success(200, "My registrations", rows.map((r) => ({ id: r.id, tournamentId: r.tournamentId, teamName: r.teamName, status: r.status, callPhone: r.status === "approved" ? r.tournament.hostPhone : null }))));
  }),
);

// A customer takes their own team back before the host has confirmed it. After the host confirms, they must call the host.
router.delete(
  "/my-registrations/:regId",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const phone = (req as AuthRequest).user!.id;
    const r = await prisma.registration.findUnique({ where: { id: req.params.regId } });
    if (!r || r.contactPhone !== phone) throw new AppError(404, "Registration not found");
    if (r.status !== "pending") throw new AppError(409, "The host has already confirmed your team. Please call the host to cancel.");
    // kept (not deleted) so the host still sees it under Cancelled; the place and the name are free again
    await prisma.registration.update({ where: { id: r.id }, data: { status: "cancelled" } });
    res.json(ApiResponseUtil.success(200, "Registration cancelled", { id: r.id }));
  }),
);

router.post(
  "/:id/register",
  authMiddleware,
  perHour,
  asyncHandler(async (req: Request, res: Response) => {
    const r = await registerTeam(req.params.id, req.body as TeamInput);
    res.status(201).json(ApiResponseUtil.success(201, "Team registered. The tournament host will confirm it.", r));
  }),
);

export default router;
