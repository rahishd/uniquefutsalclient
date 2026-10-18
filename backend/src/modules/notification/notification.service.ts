import smsService from "../../services/sms.service";
import logger from "../../config/logger";
import { prisma } from "../../config/db";
import pushService from "../push/push.service";

export const NOTICE_TYPES = [
  "challenge",
  "payment",
  "booking",
  "reminder",
  "membership",
  "match",
  "promo",
  "points",
  "tournament",
  "gamezone",
  "complaint",
  "academy",
  "referral",
  "players",
  "insurance",
] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export interface NewNotice {
  userId: string;
  type: NoticeType;
  title: string;
  message: string;
  href?: string;
  // Same key = same notice, so a retried job or a replayed webhook never sends it twice.
  dedupeKey?: string;
}

export class NotificationService {
  async sendCustomSms(phoneNumber: string, message: string): Promise<void> {
    logger.info(`Sending custom SMS to ${phoneNumber}: ${message}`);
    await smsService.send({
      phoneNumber,
      message,
    });
  }

  // Creates an in-app notice for a customer. Never throws: a failed notice must not break a booking or payment.
  async notify(n: NewNotice): Promise<void> {
    try {
      if (n.dedupeKey) {
        const exists = await prisma.notification.findUnique({ where: { dedupeKey: n.dedupeKey } });
        if (exists) return;
      }
      const user = await prisma.user.findUnique({ where: { phoneNumber: n.userId }, select: { phoneNumber: true } });
      if (!user) return; // guests have no inbox
      await prisma.notification.create({
        data: {
          userId: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          href: n.href ?? null,
          dedupeKey: n.dedupeKey ?? null,
        },
      });
      // Also reach a closed app (only when this notice was new: the dedupe check above returns early otherwise).
      await pushService.sendToUser(n.userId, n.type, { title: n.title, body: n.message, href: n.href, tag: n.dedupeKey });
    } catch (error) {
      logger.error("Failed to create notification", error);
    }
  }

  async list(userId: string, limit = 50) {
    const items = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
    const unread = items.filter((i) => !i.isRead);
    const unreadByType: Record<string, number> = {};
    for (const i of unread) unreadByType[i.type] = (unreadByType[i.type] ?? 0) + 1;
    const pointsLinks = await this.pointsLinks(userId, items);
    return {
      items: items.map((i) => ({ id: i.id, type: i.type, title: i.title, body: i.message, at: i.createdAt, read: i.isRead, href: pointsLinks.get(i.id) ?? i.href })),
      unread: unread.length,
      unreadByType,
    };
  }

  /**
   * Points notices made before they carried a row link only say "/points". Work out the exact ledger row for them
   * (from the key the notice was made with, or failing that the row written at the same moment) so tapping one
   * still highlights the right line on the Points page. Notices that already link to a row are left alone.
   */
  private async pointsLinks(userId: string, items: { id: string; type: string; href: string | null; dedupeKey: string | null; createdAt: Date }[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const open = items.filter((i) => i.type === "points" && i.href === "/points");
    if (open.length === 0) return out;
    const entries = await prisma.loyaltyEntry.findMany({ where: { userId }, select: { id: true, kind: true, sourceType: true, sourceId: true, createdAt: true } });
    const byKey = new Map<string, string>();
    for (const e of entries) {
      byKey.set(`points-${e.kind}-${e.sourceType}-${e.sourceId}`, e.id);
      if (e.sourceType === "gift") byKey.set(`gift-in-${e.sourceId}`, e.id);
      if (e.sourceType === "gift_refund") byKey.set(`gift-cancel-in-${e.sourceId}`, e.id);
    }
    for (const n of open) {
      let id = n.dedupeKey ? byKey.get(n.dedupeKey) : undefined;
      if (!id) {
        // no key to go by (or nothing matches): the row written within two minutes of the notice, nearest first
        let best = Infinity;
        for (const e of entries) {
          const gap = Math.abs(e.createdAt.getTime() - n.createdAt.getTime());
          if (gap < best && gap <= 120_000) { best = gap; id = e.id; }
        }
      }
      if (id) out.set(n.id, `/points?hl=${id}`);
    }
    return out;
  }

  async markRead(userId: string, id: string): Promise<number> {
    const r = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    return r.count;
  }

  // Mark everything read, or only some types (opening a Popular tile marks its own types read).
  async markAllRead(userId: string, types?: string[]): Promise<number> {
    const r = await prisma.notification.updateMany({
      where: { userId, isRead: false, ...(types && types.length ? { type: { in: types } } : {}) },
      data: { isRead: true },
    });
    return r.count;
  }

  async clearAll(userId: string): Promise<number> {
    const r = await prisma.notification.deleteMany({ where: { userId } });
    return r.count;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
