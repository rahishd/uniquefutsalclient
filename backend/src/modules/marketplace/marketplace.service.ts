import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { prisma } from "../../config/db";
import { isLive } from "../content/content.service";
import { AppError } from "../../middlewares/error.middleware";
import { todayKey } from "../../utils/dates";
import { planShare, r1, summarize } from "../../utils/loyaltyPoints";
import loyaltyService from "../loyalty/loyalty.service";
import notificationService from "../notification/notification.service";

// Partner Marketplace (customer side). Businesses that have an agreement with Unique Futsal (cafes, swimming pools ...) give our customers a
// discount for loyalty points. A customer redeems points for a card with a code and shows it at the partner. Staff set the partners, the
// agreement dates and what each discount costs in the admin portal; the partner sees who redeemed on its own dashboard.
const num = (d: Prisma.Decimal | number) => Number(d);
const mediaUrl = (id: string) => `/api/content/media/${id}`;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => "UFM-" + Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");

// A card is good for one week from the day it was made; after that it is "expired" (unused) and cannot be used.
export const CARD_VALID_DAYS = 7;
export const cardExpiresAt = (createdAt: Date) => new Date(createdAt.getTime() + CARD_VALID_DAYS * 86_400_000);
export const cardStatus = (r: { status: string; createdAt: Date }, now = new Date()) => (r.status === "active" && cardExpiresAt(r.createdAt) <= now ? "expired" : r.status);

// the short code the customer shows: UFM01, UFM02 ... counted per partner, so the partner sees a clean running list
const shortCodeOf = (n: number) => `UFM${String(n).padStart(2, "0")}`;

const partnerLive = (p: { active: boolean; agreementStart: string; agreementEnd: string }, today = todayKey()) => p.active && p.agreementStart <= today && today <= p.agreementEnd;

export class MarketplaceService {
  /** The partners customers can use right now (agreement running, switched on) with their offers. Empty list = nothing to show. */
  async list() {
    const today = todayKey();
    const partners = await prisma.marketplacePartner.findMany({
      where: { active: true, agreementStart: { lte: today }, agreementEnd: { gte: today } },
      include: { offers: { where: { active: true }, orderBy: { pointsCost: "asc" } } },
      orderBy: [{ bannerPriority: "desc" }, { createdAt: "asc" }],
    });
    return partners
      .filter((p) => p.offers.length > 0)
      .map((p) => ({
        // the banner shows only inside its own schedule (days, hours, weekdays, on or off), the same rule as an ad; the offers show either way
        id: p.id, name: p.name, category: p.category, about: p.about, validUntil: p.agreementEnd, bannerSeconds: p.bannerSeconds,
        bannerUrl: p.bannerMediaId && isLive({ active: p.bannerOn, startDate: p.bannerStart, endDate: p.bannerEnd, dailyStart: p.bannerDailyStart, dailyEnd: p.bannerDailyEnd, days: p.bannerDays }) ? mediaUrl(p.bannerMediaId) : null,
        offers: p.offers.map((o) => ({ id: o.id, title: o.title, discountText: o.discountText, pointsCost: num(o.pointsCost), maxPerCustomer: o.maxPerCustomer })),
      }));
  }

  /** Spend points on an offer. Locked per customer (the same lock a free-game claim uses) so two taps cannot spend the same points twice. */
  async redeem(userId: string, offerId: string) {
    const offer = await prisma.marketplaceOffer.findUnique({ where: { id: offerId }, include: { partner: true } });
    if (!offer || !offer.active || !partnerLive(offer.partner)) throw new AppError(404, "This offer is not available right now");
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true, isActive: true } });
    if (!user || !user.isActive) throw new AppError(403, "Sign in with a customer account to redeem points.");
    const cost = r1(num(offer.pointsCost));
    const today = todayKey();

    const card = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"loyalty:" + userId}))`;
      if (offer.maxPerCustomer) {
        const used = await tx.marketplaceRedemption.count({ where: { offerId: offer.id, userId, status: { not: "cancelled" } } });
        if (used >= offer.maxPerCustomer) throw new AppError(409, `You have already used this offer ${offer.maxPerCustomer === 1 ? "once" : offer.maxPerCustomer + " times"}.`);
      }
      const ledger = await loyaltyService.ledger(userId, tx);
      const summary = summarize(ledger, today);
      if (summary.remaining < cost) throw new AppError(409, `Not enough points. This offer costs ${cost} points and you have ${summary.remaining}.`);
      const spent = planShare(ledger, today, cost).map((p) => ({ expiresOn: p.expiresOn, points: p.points }));
      let code = newCode();
      for (let i = 0; i < 5 && (await tx.marketplaceRedemption.findUnique({ where: { code } })); i++) code = newCode();
      // the code the customer shows: the next number of this partner's cards (locked per partner so two customers cannot get the same one)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"marketplace:" + offer.partnerId}))`;
      let seq = (await tx.marketplaceRedemption.count({ where: { partnerId: offer.partnerId } })) + 1;
      while (await tx.marketplaceRedemption.findFirst({ where: { partnerId: offer.partnerId, shortCode: shortCodeOf(seq) }, select: { id: true } })) seq++;
      const shortCode = shortCodeOf(seq);
      const r = await tx.marketplaceRedemption.create({
        data: { partnerId: offer.partnerId, offerId: offer.id, userId, customerName: user.name ?? null, points: new Prisma.Decimal(cost.toFixed(1)), code, shortCode, spent: JSON.stringify(spent) },
      });
      await tx.loyaltyEntry.create({
        data: {
          userId, kind: "free_game", points: new Prisma.Decimal((-cost).toFixed(1)), earnedOn: today, expiresOn: null, sourceType: "partner", sourceId: r.id,
          detail: `${offer.partner.name}: ${offer.discountText}`,
        },
      });
      return r;
    });

    await notificationService.notify({
      userId, type: "points", title: `Your ${offer.partner.name} card is ready`,
      message: `${offer.discountText}. Show the code ${card.shortCode ?? card.code} at ${offer.partner.name}. ${cost} loyalty points were used.`, href: "/marketplace", dedupeKey: `partner-card-${card.id}`,
    });
    return this.cardView({ ...card, offer, partner: offer.partner });
  }

  private cardView(r: { id: string; code: string; shortCode: string | null; status: string; points: Prisma.Decimal; createdAt: Date; usedAt: Date | null; offer: { title: string; code: string; discountText: string }; partner: { name: string; category: string; agreementEnd: string; bannerMediaId: string | null } }) {
    return {
      id: r.id, cardCode: r.shortCode ?? r.code, status: cardStatus(r), expiresAt: cardExpiresAt(r.createdAt), points: num(r.points), createdAt: r.createdAt, usedAt: r.usedAt,
      partner: r.partner.name, category: r.partner.category, validUntil: cardExpiresAt(r.createdAt).toISOString().slice(0, 10), bannerUrl: r.partner.bannerMediaId ? mediaUrl(r.partner.bannerMediaId) : null,
      offerTitle: r.offer.title, discountText: r.offer.discountText, discountCode: r.offer.code,
    };
  }

  /** My cards: what I redeemed, newest first. */
  async cards(userId: string) {
    const rows = await prisma.marketplaceRedemption.findMany({ where: { userId }, include: { offer: true, partner: true }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((r) => this.cardView(r));
  }

  /** The customer's loyalty card: who they are, what they hold, and the latest points they earned (each a proof of a billing to show a partner). */
  async loyaltyCard(userId: string) {
    const today = todayKey();
    const [user, ledger] = await Promise.all([prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true, phoneNumber: true, createdAt: true } }), loyaltyService.ledger(userId)]);
    if (!user) throw new AppError(404, "Account not found");
    const summary = summarize(ledger, today);
    const rows = await prisma.loyaltyEntry.findMany({ where: { userId, points: { gt: 0 } }, orderBy: { createdAt: "desc" }, take: 10 });
    return {
      name: user.name ?? "Unique Futsal player", phone: user.phoneNumber, memberSince: user.createdAt.toISOString().slice(0, 10), balance: summary.remaining,
      earned: rows.map((r) => ({ id: r.id, kind: r.kind, points: num(r.points), on: r.earnedOn, detail: r.detail, expiresOn: r.expiresOn })),
    };
  }
}

export const marketplaceService = new MarketplaceService();
export default marketplaceService;
