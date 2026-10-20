import { randomInt } from "crypto";
import { ChatMember, ChatThread } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import complaintService from "../complaint/complaint.service";
import pushService from "../push/push.service";

// Chat between registered customers: one to one and groups. Text only. Everything is decided here: who may read a
// thread (its members only), who may add or remove people (group admins), and how fast one person may send.
export const BODY_MAX = 1000;
export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 40;
export const GROUP_MAX_MEMBERS = 50;
export const GROUPS_PER_DAY = 5; // groups one customer can create in 24 hours
export const SENDS_PER_MINUTE = 20;
export const PAGE = 60;
export const DELETED_NOTE = "This message was deleted";

// Reporting a message from someone else: it becomes a complaint (category "chat") the venue reads in the admin portal.
export const REPORT_REASONS = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate", label: "Inappropriate or offensive" },
  { id: "spam", label: "Spam or scam" },
  { id: "threat", label: "Threat or violence" },
  { id: "other", label: "Something else" },
] as const;
export const REPORTS_PER_DAY = 10;
export const REPORT_NOTE_MAX = 300;

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

export const REPLY_PREVIEW = 100;
export const PUSH_QUIET_MS = 10_000; // someone who read the chat this recently has it open: no push

interface ReplyPreview {
  id: string;
  senderName: string;
  body: string;
  deleted: boolean;
}

// The messages that others in `rows` reply to, as short previews (looked up in the same chat only).
async function replyPreviews(userId: string, threadId: string, rows: { replyToId: string | null }[]): Promise<Map<string, ReplyPreview>> {
  const ids = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => !!x))];
  if (!ids.length) return new Map();
  const originals = await prisma.chatMessage.findMany({ where: { id: { in: ids }, threadId } });
  const people = await peopleByPhone([...new Set(originals.map((o) => o.senderId))]);
  return new Map(
    originals.map((o) => [
      o.id,
      { id: o.id, senderName: o.senderId === userId ? "You" : personOf(people, o.senderId).name, body: o.deletedAt ? "" : o.body.slice(0, REPLY_PREVIEW), deleted: !!o.deletedAt },
    ]),
  );
}

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
    const all = await prisma.chatMember.findMany({
      where: { userId },
      include: { thread: { include: { members: { select: { userId: true, lastReadAt: true } } } } },
      orderBy: { thread: { lastMessageAt: "desc" } },
      take: 100,
    });
    // a chat the member deleted stays out of their list until someone writes in it again
    const mine = all.filter((m) => !m.clearedAt || m.thread.lastMessageAt > m.clearedAt);
    const others = mine.flatMap((m) => (m.thread.kind === "direct" ? m.thread.members.map((x) => x.userId).filter((p) => p !== userId) : []));
    const people = await peopleByPhone([...new Set(others)]);
    const senders = await peopleByPhone([...new Set(mine.map((m) => m.thread.lastSenderId).filter((s): s is string => !!s))]);

    return Promise.all(
      mine.map(async (m) => {
        const t = m.thread;
        const unread = await prisma.chatMessage.count({ where: { threadId: t.id, createdAt: { gt: m.lastReadAt }, deletedAt: null, NOT: { senderId: userId } } });
        // my last message: has everyone else opened the chat since it was sent?
        const rest = t.members.filter((x) => x.userId !== userId);
        const lastSeen = t.lastSenderId === userId ? rest.length > 0 && rest.every((x) => x.lastReadAt >= t.lastMessageAt) : null;
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
          lastSeen,
          unread,
        };
      }),
    );
  }

  async unreadTotal(userId: string) {
    const mine = await prisma.chatMember.findMany({ where: { userId }, select: { threadId: true, lastReadAt: true }, take: 200 });
    let total = 0;
    for (const m of mine) {
      total += await prisma.chatMessage.count({ where: { threadId: m.threadId, createdAt: { gt: m.lastReadAt }, deletedAt: null, NOT: { senderId: userId } } });
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
      const from = m.clearedAt && m.clearedAt > afterDate ? m.clearedAt : afterDate;
      rows = await prisma.chatMessage.findMany({ where: { threadId, createdAt: { gt: from } }, orderBy: { createdAt: "asc" }, take: 200 });
    } else {
      rows = (await prisma.chatMessage.findMany({ where: { threadId, ...(m.clearedAt ? { createdAt: { gt: m.clearedAt } } : {}) }, orderBy: { createdAt: "desc" }, take: PAGE })).reverse();
    }
    const people = await peopleByPhone([...new Set(rows.map((r) => r.senderId))]);
    const replies = await replyPreviews(userId, threadId, rows);
    await prisma.chatMember.update({ where: { id: m.id }, data: { lastReadAt: new Date() } });
    return rows.map((r) => ({
      id: r.id,
      senderId: r.senderId,
      senderName: r.senderId === userId ? "You" : personOf(people, r.senderId).name,
      body: r.deletedAt ? "" : r.body,
      createdAt: r.createdAt,
      mine: r.senderId === userId,
      deleted: !!r.deletedAt,
      replyTo: r.replyToId ? (replies.get(r.replyToId) ?? null) : null,
    }));
  }

  /**
   * What changed in messages the reader already has: when each other person last opened the chat (so the app can show
   * Seen or Sent on my messages) and which recent messages were deleted. Does not mark anything as read.
   */
  async status(userId: string, threadId: string) {
    await membership(userId, threadId);
    const [others, deleted] = await Promise.all([
      prisma.chatMember.findMany({ where: { threadId, NOT: { userId } }, select: { lastReadAt: true } }),
      prisma.chatMessage.findMany({ where: { threadId, deletedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true } }),
    ]);
    return { reads: others.map((o) => o.lastReadAt), deleted: deleted.map((d) => d.id) };
  }

  /** The sender deletes their own message for everyone: the words are erased and a "deleted" note stays in the chat. */
  /** Delete the whole chat for me: its messages disappear from my side and it leaves my list. Everyone else keeps it. */
  async deleteChatForMe(userId: string, threadId: string) {
    const m = await membership(userId, threadId);
    const now = new Date();
    await prisma.chatMember.update({ where: { id: m.id }, data: { clearedAt: now, lastReadAt: now } });
    return { id: threadId, deleted: true };
  }

  async deleteMessage(userId: string, threadId: string, messageId: string) {
    await membership(userId, threadId);
    const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, threadId } });
    if (!msg) throw new AppError(404, "Message not found.");
    if (msg.senderId !== userId) throw new AppError(403, "You can only delete your own messages.");
    if (!msg.deletedAt) {
      await prisma.chatMessage.update({ where: { id: msg.id }, data: { deletedAt: new Date(), body: "" } });
      const latest = await prisma.chatMessage.findFirst({ where: { threadId }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (latest?.id === msg.id) await prisma.chatThread.update({ where: { id: threadId }, data: { lastMessage: DELETED_NOTE } });
    }
    return { id: msg.id, deleted: true };
  }

  /** Report a message someone else sent in a chat you are in. The venue sees it under Complaints. */
  async reportMessage(userId: string, threadId: string, messageId: string, input: { reason?: unknown; note?: unknown }) {
    const m = await membership(userId, threadId);
    const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, threadId } });
    if (!msg) throw new AppError(404, "Message not found.");
    if (msg.deletedAt) throw new AppError(409, "This message was deleted.");
    if (msg.senderId === userId) throw new AppError(400, "You cannot report your own message.");
    const reason = REPORT_REASONS.find((r) => r.id === input.reason);
    if (!reason) throw new AppError(400, "Choose why you are reporting this message.");
    const note = typeof input.note === "string" ? input.note.trim() : "";
    if (note.length > REPORT_NOTE_MAX) throw new AppError(400, `Please keep the note under ${REPORT_NOTE_MAX} characters.`);

    const ref = `Message ref: ${msg.id}`;
    if (await prisma.complaint.findFirst({ where: { userId, category: "chat", message: { contains: ref } }, select: { id: true } })) {
      throw new AppError(409, "You already reported this message. The venue will look into it.");
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.complaint.count({ where: { userId, category: "chat", createdAt: { gte: since } } })) >= REPORTS_PER_DAY) {
      throw new AppError(429, `You can send up to ${REPORTS_PER_DAY} chat reports a day. Please try again tomorrow, or call the venue.`);
    }

    const sender = await prisma.user.findUnique({ where: { phoneNumber: msg.senderId }, select: { name: true } });
    const where = m.thread.kind === "group" ? `group "${m.thread.name ?? "Group"}"` : "a one-to-one chat";
    const lines = [
      `Reported chat message (${reason.label})`,
      `From: ${sender?.name ?? "A customer"} (${msg.senderId})`,
      `In: ${where}`,
      `Message: "${msg.body.slice(0, 300)}"`,
      ...(note ? [`Note from the customer: ${note}`] : []),
      ref,
    ];
    const c = await complaintService.createReport(userId, "chat", lines.join(String.fromCharCode(10)));
    return { reported: true, code: c.code };
  }

  async send(userId: string, threadId: string, bodyInput: unknown, replyToInput?: unknown) {
    const m = await membership(userId, threadId);
    const body = typeof bodyInput === "string" ? bodyInput.trim() : "";
    if (!body) throw new AppError(400, "Write a message first.");
    if (body.length > BODY_MAX) throw new AppError(400, `Please keep a message under ${BODY_MAX} characters.`);

    const minuteAgo = new Date(Date.now() - 60 * 1000);
    if ((await prisma.chatMessage.count({ where: { senderId: userId, createdAt: { gte: minuteAgo } } })) >= SENDS_PER_MINUTE) {
      throw new AppError(429, "You are sending messages too quickly. Please wait a moment.");
    }

    // a reply must point at a message of this same chat
    const replyToId = typeof replyToInput === "string" && replyToInput ? replyToInput : null;
    if (replyToId && !(await prisma.chatMessage.findFirst({ where: { id: replyToId, threadId }, select: { id: true } }))) {
      throw new AppError(404, "The message you are replying to was not found.");
    }

    const msg = await prisma.chatMessage.create({ data: { threadId, senderId: userId, body, replyToId } });
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessage: body.slice(0, 120), lastSenderId: userId, lastMessageAt: msg.createdAt },
    });
    await prisma.chatMember.update({ where: { id: m.id }, data: { lastReadAt: msg.createdAt } });
    const replies = await replyPreviews(userId, threadId, [msg]);
    void this.notifyMembers(userId, m.thread, msg.id, body);
    return { id: msg.id, senderId: userId, senderName: "You", body: msg.body, createdAt: msg.createdAt, mine: true, deleted: false, replyTo: replyToId ? (replies.get(replyToId) ?? null) : null };
  }

  /** Push alert to every other member's phone for a new message (even when the app is closed). Never throws; skips anyone with the chat open. */
  private async notifyMembers(senderId: string, thread: ChatThread, messageId: string, body: string) {
    try {
      const quiet = new Date(Date.now() - PUSH_QUIET_MS);
      const others = await prisma.chatMember.findMany({ where: { threadId: thread.id, NOT: { userId: senderId } }, select: { userId: true, lastReadAt: true } });
      const targets = others.filter((o) => o.lastReadAt < quiet).map((o) => o.userId);
      if (!targets.length) return;
      const sender = personOf(await peopleByPhone([senderId]), senderId).name;
      const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;
      const payload = thread.kind === "group"
        ? { title: thread.name ?? "Group chat", body: `${sender}: ${preview}` }
        : { title: sender, body: preview };
      await Promise.all(targets.map((userId) => pushService.sendToUser(userId, "chat", { ...payload, href: `/chat/${thread.id}`, tag: `chat-${thread.id}-${messageId}` })));
    } catch {
      // a failed alert must never break sending a message
    }
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
