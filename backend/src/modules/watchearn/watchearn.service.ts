import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import notificationService from "../notification/notification.service";
import loyaltyService from "../loyalty/loyalty.service";
import { AuditService } from "../audit";
import { todayKey } from "../../utils/dates";
import { expiryFor, summarize } from "../../utils/loyaltyPoints";

// Watch & Earn: the customer watches ads one after another and earns loyalty points.
//
// Rules (all enforced here, never in the browser):
// - 1 ad = 15 seconds. The SERVER times it: a view starts with POST /views and only counts when POST /views/:id/complete
//   arrives at least 15 seconds later (a 1 second allowance for the network). Completing early is refused.
// - Only one view is open per customer: starting a new one closes the old one, so ads cannot be run in parallel and the
//   fastest possible rate is one counted ad every 15 seconds.
// - 40 counted ads (10 minutes of ads) = 1 loyalty point. The point is written in the same transaction as the 40th ad
//   (unique ledger key per block of 40), valid for 3 months like game points.
// - A view not completed within 5 minutes is abandoned and never counts. Completing twice counts once.
export const AD_SECONDS = 15;
export const ADS_PER_POINT = 40;
export const SLACK_MS = 1000;
export const STALE_MS = 5 * 60 * 1000;

export const rules = () => ({ adSeconds: AD_SECONDS, adsPerPoint: ADS_PER_POINT, pointsPerBlock: 1, minutesPerPoint: (AD_SECONDS * ADS_PER_POINT) / 60 });

const progress = (views: number, points: number) => ({
  totalViews: views, pointsEarned: points, adsTowardNext: views % ADS_PER_POINT, adsLeftForNext: ADS_PER_POINT - (views % ADS_PER_POINT),
});

export class WatchEarnService {
  async abandonStale(userId?: string): Promise<number> {
    const r = await prisma.watchEarnView.updateMany({
      where: { status: "active", startedAt: { lt: new Date(Date.now() - STALE_MS) }, ...(userId ? { userId } : {}) },
      data: { status: "abandoned" },
    });
    return r.count;
  }

  async me(userId: string) {
    const today = todayKey();
    const [stat, todayViews, ledger] = await Promise.all([
      prisma.watchEarnStat.findUnique({ where: { userId } }),
      prisma.watchEarnView.count({ where: { userId, day: today, status: "counted" } }),
      loyaltyService.ledger(userId),
    ]);
    return { rules: rules(), ...progress(stat?.views ?? 0, stat?.points ?? 0), todayViews, balance: summarize(ledger, today).remaining };
  }

  /** Opens a view of one ad. Any view still open is closed first, so only one runs at a time. */
  async start(userId: string, adId?: string | null) {
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { isActive: true } });
    if (!user || !user.isActive) throw new AppError(403, "Sign in with an active account to earn points.");
    const day = todayKey();
    const view = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${"watchearn:" + userId}))`;
      await tx.watchEarnView.updateMany({ where: { userId, status: "active" }, data: { status: "abandoned" } });
      return tx.watchEarnView.create({ data: { userId, day, adId: adId ? String(adId).slice(0, 64) : null } });
    });
    return { viewId: view.id, seconds: AD_SECONDS, startedAt: view.startedAt };
  }

  /** Counts the view once its 15 seconds are up. Safe to send twice. */
  async complete(userId: string, viewId: string) {
    const out = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "WatchEarnView" WHERE id = ${viewId} AND "userId" = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new AppError(404, "View not found");
      const view = await tx.watchEarnView.findUniqueOrThrow({ where: { id: viewId } });
      if (view.status === "counted") return { already: true, earned: 0, rewardId: null as string | null, views: 0, points: 0 };
      if (view.status === "abandoned") throw new AppError(409, "This ad was closed. Start the next one.");

      const now = new Date();
      const elapsed = now.getTime() - view.startedAt.getTime();
      if (elapsed > STALE_MS) {
        await tx.watchEarnView.update({ where: { id: view.id }, data: { status: "abandoned" } });
        throw new AppError(409, "This ad timed out. Start the next one.");
      }
      if (elapsed < AD_SECONDS * 1000 - SLACK_MS) throw new AppError(409, `Keep watching: the ad runs ${AD_SECONDS} seconds.`);

      await tx.watchEarnView.update({ where: { id: view.id }, data: { status: "counted", countedAt: now } });
      await tx.watchEarnStat.upsert({ where: { userId }, create: { userId }, update: {} });
      await tx.$queryRaw`SELECT "userId" FROM "WatchEarnStat" WHERE "userId" = ${userId} FOR UPDATE`;
      const stat = await tx.watchEarnStat.findUniqueOrThrow({ where: { userId } });
      const views = stat.views + 1;

      let points = stat.points;
      let earned = 0;
      let rewardId: string | null = null;
      if (views % ADS_PER_POINT === 0) {
        const block = views / ADS_PER_POINT;
        const entry = await tx.loyaltyEntry.create({
          data: {
            userId, kind: "watch_earn", points: new Prisma.Decimal("1.0"), earnedOn: view.day,
            expiresOn: expiryFor("watch_earn", view.day) ?? null, sourceType: "watch_earn", sourceId: `${userId}:${block}`,
            detail: `Watch & Earn: ${ADS_PER_POINT} ads watched`,
          },
        });
        earned = 1;
        rewardId = entry.id;
        points += 1;
      }
      await tx.watchEarnStat.update({ where: { userId }, data: { views, points } });
      return { already: false, earned, rewardId, views, points };
    });

    if (out.earned > 0 && out.rewardId) {
      const block = out.views / ADS_PER_POINT;
      await AuditService.log({ action: "WATCH_EARN_POINT", entity: "WatchEarnStat", entityId: userId, changes: `block ${block}, reward ${out.rewardId}`, userId });
      await notificationService.notify({
        userId, type: "points", title: "Points earned",
        message: `+1 loyalty point: Watch & Earn (${ADS_PER_POINT} ads)`,
        href: await loyaltyService.pointsHref(userId, "watch_earn", `${userId}:${block}`), dedupeKey: `points-watch_earn-watch_earn-${userId}:${block}`,
      });
    }
    return { counted: !out.already, earnedNow: out.earned, ...(await this.me(userId)) };
  }
}

export default new WatchEarnService();
