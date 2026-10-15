import { randomInt } from "crypto";
import { ChatMember, ChatThread } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";

// Chat between registered customers: one to one and groups. Text only. Everything is decided here: who may read a
// thread (its members only), who may add or remove people (group admins), and how fast one person may send.
export const BODY_MAX = 1000;
export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 40;
export const GROUP_MAX_MEMBERS = 50;
export const GROUPS_PER_DAY = 5; // groups one customer can create in 24 hours
export const SENDS_PER_MINUTE = 20;
export const PAGE = 60;

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeInvite = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const digits = (s: unknown) => (typeof s === "string" ? s.replace(/\D/g, "") : "");

interface Person {
  phone: string;
  name: string;
  avatar: string | null;
}

async function peopleByPhone(phones: string[]): Promise<Map<string, Person>> {
  const users = phones.length
    ? await prisma.user.findMany({ where: { phoneNumber: { in: phones } }, select: { phoneNumber: true, name: true, avatar: true } })
    : [];
  return new Map(
    users.map((u) => [u.phoneNumber, { phone: u.phoneNumber, name: u.name?.trim() || `Player ${u.phoneNumber.slice(-4)}`, avatar: u.avatar }]),
  );
}
const personOf = (map: Map<string, Person>, phone: string): Person => map.get(phone) ?? { phone, name: "Former member", avatar: null };

async function membership(userId: string, threadId: string) {
  const m = await prisma.chatMember.findUnique({ where: { threadId_userId: { threadId, userId } }, include: { thread: true } });
  // not a member and "no such chat" look the same, so thread ids cannot be probed
  if (!m) throw new AppError(404, "Chat not found.");
  return m;
}

const requireGroupAdmin = (m: ChatMember & { thread: ChatThread }) => {
  if (m.thread.kind !== "group") throw new AppError(400, "This is not a group.");
  if (m.role !== "admin") throw new AppError(403, "Only a group admin can do that.");
};

async function addToGroup(threadId: string, phones: string[], alreadyIn: number) {
  const room = GROUP_MAX_MEMBERS - alreadyIn;
  if (phones.length > room) throw new AppError(400, `A group can have up to ${GROUP_MAX_MEMBERS} people.`);
  if (phones.length) {
    await prisma.chatMember.createMany({ data: phones.map((userId) => ({ threadId, userId })), skipDuplicates: true });
  }
}

// A phone typed by the customer must be a registered, active customer.
async function resolveCustomers(phones: string[], exclude: string): Promise<string[]> {
  const wanted = [...new Set(phones.map(digits).filter((p) => p && p !== exclude))];
  if (!wanted.length) return [];
  const found = await prisma.user.findMany({ where: { phoneNumber: { in: wanted }, isActive: true, role: "user" }, select: { phoneNumber: true } });
  const ok = new Set(found.map((u) => u.phoneNumber));
  const missing = wanted.filter((p) => !ok.has(p));
  if (missing.length) throw new AppError(404, `${missing[0]} is not registered with Unique Futsal.`);
  return wanted;
}

export class ChatService {
  /** Search customers by the start of a mobile number (at least 5 digits). Never lists everybody. */
  async people(userId: string, q: unknown) {
    const d = digits(q);
    if (d.length < 5) return [];
    const rows = await prisma.user.findMany({
      where: { phoneNumber: { startsWith: d }, isActive: true, role: "user", NOT: { phoneNumber: userId } },
      select: { phoneNumber: true, name: true, avatar: true },
      orderBy: { phoneNumber: "asc" },
      take: 10,
    });
    return rows.map((u) => ({ phone: u.phoneNumber, name: u.name?.trim() || `Player ${u.phoneNumber.slice(-4)}`, avatar: u.avatar }));
  }

  async threads(userId: string) {
    const mine = await prisma.chatMember.findMany({
      where: { userId },
      include: { thread: { include: { members: { select: { userId: true } } } } },
      orderBy: { thread: { lastMessageAt: "desc" } },
      take: 100,
    });
    const others = mine.flatMap((m) => (m.thread.kind === "direct" ? m.thread.members.map((x) => x.userId).filter((p) => p !== userId) : []));
    const people = await peopleByPhone([...new Set(others)]);
    const senders = await peopleByPhone([...new Set(mine.map((m) => m.thread.lastSenderId).filter((s): s is string => !!s))]);

    return Promise.all(
      mine.map(async (m) => {
        const t = m.thread;
        const unread = await prisma.chatMessage.count({ where: { threadId: t.id, createdAt: { gt: m.lastReadAt }, NOT: { senderId: userId } } });
        const other = t.kind === "direct" ? personOf(people, t.members.map((x) => x.userId).find((p) => p !== userId) ?? "") : null;
        return {
          id: t.id,
          kind: t.kind,
          title: t.kind === "group" ? t.name ?? "Group" : other!.name,
          avatar: other?.avatar ?? null,
          memberCount: t.members.length,
          lastMessage: t.lastMessage,
          lastFrom: t.lastSenderId ? (t.lastSenderId === userId ? "You" : personOf(senders, t.lastSenderId).name) : null,
          lastMessageAt: t.lastMessageAt,
          unread,
        };
      }),
    );
  }

  async unreadTotal(userId: string) {
    const mine = await prisma.chatMember.findMany({ where: { userId }, select: { threadId: true, lastReadAt: true }, take: 200 });
    let total = 0;
    for (const m of mine) {
      total += await prisma.chatMessage.count({ where: { threadId: m.threadId, createdAt: { gt: m.lastReadAt }, NOT: { senderId: userId } } });
    }
    return total;
  }

  async openDirect(userId: string, phoneInput: unknown) {
    const [other] = await resolveCustomers([String(phoneInput ?? "")], userId);
    if (!other) throw new AppError(400, "You cannot chat with yourself. Enter another customer's mobile number.");
    const key = [userId, other].sort().join("|");
    let thread = await prisma.chatThread.findUnique({ where: { directKey: key } });
    if (!thread) {
      try {
        thread = await prisma.chatThread.create({
          data: { kind: "direct", directKey: key, createdBy: userId, members: { create: [{ userId }, { userId: other }] } },
        });
      } catch {
        // both people opened it at the same moment: the other request created it
        thread = await prisma.chatThread.findUnique({ where: { directKey: key } });
        if (!thread) throw new AppError(500, "Could not open the chat. Please try again.");
      }
    }
    return { id: thread.id };
  }

  async createGroup(userId: string, input: { name?: unknown; members?: unknown }) {
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < GROUP_NAME_MIN || name.length > GROUP_NAME_MAX) {
      throw new AppError(400, `Give the group a name of ${GROUP_NAME_MIN} to ${GROUP_NAME_MAX} characters.`);
    }
    const phones = Array.isArray(input.members) ? (input.members as unknown[]).map((p) => String(p)) : [];
    const members = await resolveCustomers(phones, userId);
    if (members.length + 1 > GROUP_MAX_MEMBERS) throw new AppError(400, `A group can have up to ${GROUP_MAX_MEMBERS} people.`);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.chatThread.count({ where: { kind: "group", createdBy: userId, createdAt: { gte: since } } })) >= GROUPS_PER_DAY) {
      throw new AppError(429, `You can create up to ${GROUPS_PER_DAY} groups a day. Please try again tomorrow.`);
    }

    let inviteCode = makeInvite();
    for (let i = 0; i < 5 && (await prisma.chatThread.findUnique({ where: { inviteCode }, select: { id: true } })); i++) inviteCode = makeInvite();
    const thread = await prisma.chatThread.create({
      data: {
        kind: "group",
        name,
        inviteCode,
        createdBy: userId,
        members: { create: [{ userId, role: "admin" }, ...members.map((m) => ({ userId: m }))] },
      },
    });
    return { id: thread.id };
  }

  async thread(userId: string, threadId: string) {
    const m = await membership(userId, threadId);
    const rows = await prisma.chatMember.findMany({ where: { threadId }, orderBy: { joinedAt: "asc" } });
    const people = await peopleByPhone(rows.map((r) => r.userId));
    const members = rows.map((r) => ({ ...personOf(people, r.userId), role: r.role, you: r.userId === userId }));
    const t = m.thread;
    const other = t.kind === "direct" ? members.find((x) => !x.you) ?? null : null;
    return {
      id: t.id,
      kind: t.kind,
      title: t.kind === "group" ? t.name ?? "Group" : other?.name ?? "Chat",
      avatar: other?.avatar ?? null,
      members,
      isAdmin: m.role === "admin",
      // only a group admin sees the link
      inviteCode: t.kind === "group" && m.role === "admin" ? t.inviteCode : null,
      createdAt: t.createdAt,
    };
  }

  /** New messages after `after` (a message id or ISO time), or the latest page. Reading marks the chat as read. */
  async messages(userId: string, threadId: string, after?: unknown) {
    const m = await membership(userId, threadId);
    let rows;
    const afterDate = typeof after === "string" && after ? new Date(after) : null;
    if (afterDate && !Number.isNaN(afterDate.getTime())) {
      rows = await prisma.chatMessage.findMany({ where: { threadId, createdAt: { gt: afterDate } }, orderBy: { createdAt: "asc" }, take: 200 });
    } else {
      rows = (await prisma.chatMessage.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: PAGE })).reverse();
    }
    const people = await peopleByPhone([...new Set(rows.map((r) => r.senderId))]);
    await prisma.chatMember.update({ where: { id: m.id }, data: { lastReadAt: new Date() } });
    return rows.map((r) => ({
      id: r.id,
      senderId: r.senderId,
      senderName: r.senderId === userId ? "You" : personOf(people, r.senderId).name,
      body: r.body,
      createdAt: r.createdAt,
      mine: r.senderId === userId,
    }));
  }

  async send(userId: string, threadId: string, bodyInput: unknown) {
    const m = await membership(userId, threadId);
    const body = typeof bodyInput === "string" ? bodyInput.trim() : "";
    if (!body) throw new AppError(400, "Write a message first.");
    if (body.length > BODY_MAX) throw new AppError(400, `Please keep a message under ${BODY_MAX} characters.`);

    const minuteAgo = new Date(Date.now() - 60 * 1000);
    if ((await prisma.chatMessage.count({ where: { senderId: userId, createdAt: { gte: minuteAgo } } })) >= SENDS_PER_MINUTE) {
      throw new AppError(429, "You are sending messages too quickly. Please wait a moment.");
    }

    const msg = await prisma.chatMessage.create({ data: { threadId, senderId: userId, body } });
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessage: body.slice(0, 120), lastSenderId: userId, lastMessageAt: msg.createdAt },
    });
    await prisma.chatMember.update({ where: { id: m.id }, data: { lastReadAt: msg.createdAt } });
    return { id: msg.id, senderId: userId, senderName: "You", body: msg.body, createdAt: msg.createdAt, mine: true };
  }

  async addMembers(userId: string, threadId: string, phones: unknown) {
    const m = await membership(userId, threadId);
    requireGroupAdmin(m);
    const list = await resolveCustomers(Array.isArray(phones) ? (phones as unknown[]).map(String) : [], userId);
    const have = await prisma.chatMember.findMany({ where: { threadId }, select: { userId: true } });
    const haveSet = new Set(have.map((h) => h.userId));
    const fresh = list.filter((p) => !haveSet.has(p));
    await addToGroup(threadId, fresh, have.length);
    return this.thread(userId, threadId);
  }

  /** An admin removes someone, or a member leaves (their own phone). */
  async removeMember(userId: string, threadId: string, phoneInput: string) {
    const m = await membership(userId, threadId);
    if (m.thread.kind !== "group") throw new AppError(400, "You cannot leave a one to one chat.");
    const phone = digits(phoneInput);
    const leaving = phone === userId;
    if (!leaving) requireGroupAdmin(m);

    const target = await prisma.chatMember.findUnique({ where: { threadId_userId: { threadId, userId: phone } } });
    if (!target) throw new AppError(404, "That person is not in this group.");
    await prisma.chatMember.delete({ where: { id: target.id } });

    const rest = await prisma.chatMember.findMany({ where: { threadId }, orderBy: { joinedAt: "asc" } });
    if (rest.length === 0) {
      await prisma.chatThread.delete({ where: { id: threadId } });
    } else if (!rest.some((r) => r.role === "admin")) {
      // the group always keeps an admin: the longest-standing member takes over
      await prisma.chatMember.update({ where: { id: rest[0].id }, data: { role: "admin" } });
    }
    return { left: leaving };
  }

  async rename(userId: string, threadId: string, nameInput: unknown) {
    const m = await membership(userId, threadId);
    requireGroupAdmin(m);
    const name = typeof nameInput === "string" ? nameInput.trim().replace(/\s+/g, " ") : "";
    if (name.length < GROUP_NAME_MIN || name.length > GROUP_NAME_MAX) {
      throw new AppError(400, `Give the group a name of ${GROUP_NAME_MIN} to ${GROUP_NAME_MAX} characters.`);
    }
    await prisma.chatThread.update({ where: { id: threadId }, data: { name } });
    return this.thread(userId, threadId);
  }

  /** A new link: the old one stops working. */
  async resetInvite(userId: string, threadId: string) {
    const m = await membership(userId, threadId);
    requireGroupAdmin(m);
    let inviteCode = makeInvite();
    for (let i = 0; i < 5 && (await prisma.chatThread.findUnique({ where: { inviteCode }, select: { id: true } })); i++) inviteCode = makeInvite();
    await prisma.chatThread.update({ where: { id: threadId }, data: { inviteCode } });
    return { inviteCode };
  }

  async invitePreview(userId: string, codeInput: string) {
    const code = codeInput.trim().toUpperCase();
    const t = await prisma.chatThread.findUnique({ where: { inviteCode: code }, include: { _count: { select: { members: true } } } });
    if (!t) throw new AppError(404, "This invite link is not valid any more.");
    const already = await prisma.chatMember.findUnique({ where: { threadId_userId: { threadId: t.id, userId } }, select: { id: true } });
    return { id: t.id, name: t.name ?? "Group", memberCount: t._count.members, alreadyIn: !!already, full: t._count.members >= GROUP_MAX_MEMBERS };
  }

  async join(userId: string, codeInput: string) {
    const code = codeInput.trim().toUpperCase();
    const t = await prisma.chatThread.findUnique({ where: { inviteCode: code }, include: { members: { select: { userId: true } } } });
    if (!t) throw new AppError(404, "This invite link is not valid any more.");
    if (t.members.some((x) => x.userId === userId)) return { id: t.id };
    if (t.members.length >= GROUP_MAX_MEMBERS) throw new AppError(400, "This group is full.");
    await prisma.chatMember.create({ data: { threadId: t.id, userId } });
    return { id: t.id };
  }
}

export default new ChatService();
