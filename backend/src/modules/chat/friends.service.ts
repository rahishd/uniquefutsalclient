import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import notificationService from "../notification/notification.service";

// Friends for the Chat tab. Everything is decided here: only a registered customer can be asked, you answer only requests
// sent to you, and one person can send a limited number of requests a day.
export const REQUESTS_PER_DAY = 20;
export const PENDING_MAX = 50;

const digits = (s: unknown) => (typeof s === "string" ? s.replace(/\D/g, "") : "");
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

interface Person {
  phone: string;
  name: string;
  avatar: string | null;
}

async function people(phones: string[]): Promise<Map<string, Person>> {
  const users = phones.length ? await prisma.user.findMany({ where: { phoneNumber: { in: phones } }, select: { phoneNumber: true, name: true, avatar: true } }) : [];
  return new Map(users.map((u) => [u.phoneNumber, { phone: u.phoneNumber, name: u.name?.trim() || `Player ${u.phoneNumber.slice(-4)}`, avatar: u.avatar }]));
}
const personOf = (m: Map<string, Person>, phone: string): Person => m.get(phone) ?? { phone, name: "Former member", avatar: null };

export class FriendsService {
  /** My friends, requests sent to me, and requests I sent. */
  async overview(userId: string) {
    const rows = await prisma.friendship.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] }, orderBy: { createdAt: "desc" }, take: 300 });
    const others = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
    const map = await people([...new Set(others)]);
    const friends = rows
      .filter((r) => r.status === "accepted")
      .map((r) => ({ id: r.id, ...personOf(map, r.requesterId === userId ? r.addresseeId : r.requesterId) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const incoming = rows.filter((r) => r.status === "pending" && r.addresseeId === userId).map((r) => ({ id: r.id, from: personOf(map, r.requesterId), at: r.createdAt }));
    const outgoing = rows.filter((r) => r.status === "pending" && r.requesterId === userId).map((r) => ({ id: r.id, to: personOf(map, r.addresseeId), at: r.createdAt }));
    return { friends, incoming, outgoing };
  }

  async request(userId: string, phoneInput: unknown) {
    const phone = digits(phoneInput);
    if (!phone) throw new AppError(400, "Enter a mobile number.");
    if (phone === userId) throw new AppError(400, "You cannot add yourself.");
    const target = await prisma.user.findFirst({ where: { phoneNumber: phone, isActive: true, role: "user" }, select: { phoneNumber: true } });
    if (!target) throw new AppError(404, `${phone} is not registered with Unique Futsal.`);

    const key = pairKey(userId, phone);
    const existing = await prisma.friendship.findUnique({ where: { pairKey: key } });
    if (existing) {
      if (existing.status === "accepted") throw new AppError(409, "You are already friends.");
      if (existing.requesterId === userId) throw new AppError(409, "You already sent this request.");
      // they asked me first: asking back is the same as accepting
      const row = await prisma.friendship.update({ where: { id: existing.id }, data: { status: "accepted", respondedAt: new Date() } });
      return { id: row.id, status: "accepted" as const };
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    if ((await prisma.friendship.count({ where: { requesterId: userId, createdAt: { gte: since } } })) >= REQUESTS_PER_DAY) throw new AppError(429, "You sent a lot of requests today. Try again tomorrow.");
    if ((await prisma.friendship.count({ where: { requesterId: userId, status: "pending" } })) >= PENDING_MAX) throw new AppError(400, "You have too many requests waiting. Wait for answers or cancel some.");

    const row = await prisma.friendship.create({ data: { pairKey: key, requesterId: userId, addresseeId: phone } });
    const me = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true } });
    await notificationService.notify({
      userId: phone, type: "players", title: "New friend request",
      message: `${me?.name ?? "A player"} wants to be your friend. Open Chat to accept.`, href: "/chat", dedupeKey: `friend-req-${row.id}`,
    });
    return { id: row.id, status: "pending" as const };
  }

  async accept(userId: string, id: string) {
    const row = await prisma.friendship.findUnique({ where: { id } });
    if (!row || row.addresseeId !== userId || row.status !== "pending") throw new AppError(404, "Request not found.");
    await prisma.friendship.update({ where: { id }, data: { status: "accepted", respondedAt: new Date() } });
    const me = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true } });
    await notificationService.notify({
      userId: row.requesterId, type: "players", title: "Friend request accepted",
      message: `${me?.name ?? "A player"} is now your friend. Say hello in Chat.`, href: "/chat", dedupeKey: `friend-ok-${row.id}`,
    });
    return { accepted: true };
  }

  /** Decline a request sent to me, cancel one I sent, or remove a friend. Either side of the pair may do it. */
  async remove(userId: string, id: string) {
    const row = await prisma.friendship.findUnique({ where: { id } });
    if (!row || (row.requesterId !== userId && row.addresseeId !== userId)) throw new AppError(404, "Not found.");
    await prisma.friendship.delete({ where: { id } });
    return { removed: true };
  }
}

export default new FriendsService();
