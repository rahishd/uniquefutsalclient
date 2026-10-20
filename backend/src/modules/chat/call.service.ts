import { ChatCall } from "@prisma/client";
import { prisma } from "../../config/db";
import env from "../../config/env";
import { AppError } from "../../middlewares/error.middleware";
import pushService from "../push/push.service";

// One-to-one voice calls inside a direct chat. The audio goes straight between the two phones (WebRTC); this service only carries the
// call set-up (offer and answer) and the call state, and decides who may call whom. Everything is checked here, never in the app.
export const RING_MS = 45_000; // an unanswered call becomes "missed" after this long
export const CALLS_PER_MINUTE = 6;
export const SDP_MAX = 60_000;

type Status = "ringing" | "active" | "ended" | "declined" | "missed";

const DEFAULT_ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

/** STUN/TURN servers the phones use to find each other. Set ICE_SERVERS (JSON) to add a TURN relay for networks that need one. */
export function iceServers(): unknown[] {
  if (!env.ICE_SERVERS) return DEFAULT_ICE;
  try {
    const parsed = JSON.parse(env.ICE_SERVERS);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ICE;
  } catch {
    return DEFAULT_ICE;
  }
}

async function nameOf(phone: string) {
  const u = await prisma.user.findUnique({ where: { phoneNumber: phone }, select: { name: true, avatar: true } });
  return { name: u?.name?.trim() || `Player ${phone.slice(-4)}`, avatar: u?.avatar ?? null };
}

// a call nobody answered in time is missed
async function expire(call: ChatCall): Promise<ChatCall> {
  if (call.status === "ringing" && Date.now() - call.createdAt.getTime() > RING_MS) {
    return prisma.chatCall.update({ where: { id: call.id }, data: { status: "missed", endedAt: new Date() } });
  }
  return call;
}

async function mine(userId: string, callId: string): Promise<ChatCall> {
  const call = await prisma.chatCall.findUnique({ where: { id: callId } });
  // not a party and "no such call" look the same
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new AppError(404, "Call not found.");
  return expire(call);
}

const sdp = (v: unknown, what: string) => {
  if (typeof v !== "string" || v.length < 20 || v.length > SDP_MAX) throw new AppError(400, `Invalid call ${what}.`);
  return v;
};

class CallService {
  iceServers = iceServers;

  /** Start a call in a direct chat: rings the other person (and sends them a phone alert). */
  async start(userId: string, threadId: string, offerInput: unknown) {
    const offer = sdp(offerInput, "offer");
    const member = await prisma.chatMember.findUnique({ where: { threadId_userId: { threadId, userId } }, include: { thread: true } });
    if (!member) throw new AppError(404, "Chat not found.");
    if (member.thread.kind !== "direct") throw new AppError(400, "Calls are for one-to-one chats.");
    const other = await prisma.chatMember.findFirst({ where: { threadId, NOT: { userId } } });
    if (!other) throw new AppError(400, "There is nobody to call in this chat.");

    const minuteAgo = new Date(Date.now() - 60_000);
    if ((await prisma.chatCall.count({ where: { callerId: userId, createdAt: { gte: minuteAgo } } })) >= CALLS_PER_MINUTE) {
      throw new AppError(429, "You are calling too often. Please wait a moment.");
    }

    // either person already on a call or being rung: busy
    const live = await prisma.chatCall.findMany({
      where: { status: { in: ["ringing", "active"] }, OR: [{ callerId: { in: [userId, other.userId] } }, { calleeId: { in: [userId, other.userId] } }] },
    });
    for (const c of live) {
      const fresh = await expire(c);
      if (fresh.status === "ringing" || fresh.status === "active") {
        throw new AppError(409, fresh.callerId === userId || fresh.calleeId === userId ? "You are already on a call." : "They are on another call. Try again soon.");
      }
    }

    const call = await prisma.chatCall.create({ data: { threadId, callerId: userId, calleeId: other.userId, offer } });
    const caller = await nameOf(userId);
    void pushService
      .sendToUser(other.userId, "call", { title: caller.name, body: "Incoming voice call", href: `/chat/${threadId}`, tag: `call-${call.id}` })
      .catch(() => undefined);
    return { id: call.id, status: call.status as Status };
  }

  /** The call ringing for me right now, if any (the app asks every few seconds). */
  async incoming(userId: string) {
    const since = new Date(Date.now() - RING_MS);
    const call = await prisma.chatCall.findFirst({ where: { calleeId: userId, status: "ringing", createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
    if (!call) return null;
    const from = await nameOf(call.callerId);
    return { id: call.id, threadId: call.threadId, from: from.name, avatar: from.avatar, offer: call.offer, createdAt: call.createdAt };
  }

  /** Where the call stands. The caller also receives the answer once the other person picks up. */
  async state(userId: string, callId: string) {
    const call = await mine(userId, callId);
    return {
      id: call.id,
      status: call.status as Status,
      answer: call.callerId === userId && call.status === "active" ? call.answer : null,
      answeredAt: call.answeredAt,
    };
  }

  async answer(userId: string, callId: string, answerInput: unknown) {
    const answer = sdp(answerInput, "answer");
    const call = await mine(userId, callId);
    if (call.calleeId !== userId) throw new AppError(403, "Only the person being called can answer.");
    if (call.status !== "ringing") throw new AppError(409, call.status === "active" ? "The call was already answered." : "This call is over.");
    await prisma.chatCall.update({ where: { id: call.id }, data: { status: "active", answer, answeredAt: new Date() } });
    return { id: call.id, status: "active" as Status };
  }

  /** Hang up. The callee refusing a ringing call is "declined"; the caller giving up before an answer is "missed". */
  async end(userId: string, callId: string) {
    const call = await mine(userId, callId);
    if (call.status === "ringing") {
      const status: Status = call.calleeId === userId ? "declined" : "missed";
      await prisma.chatCall.update({ where: { id: call.id }, data: { status, endedAt: new Date() } });
      return { id: call.id, status };
    }
    if (call.status === "active") {
      await prisma.chatCall.update({ where: { id: call.id }, data: { status: "ended", endedAt: new Date() } });
      return { id: call.id, status: "ended" as Status };
    }
    return { id: call.id, status: call.status as Status }; // already over: hanging up twice is harmless
  }
}

export const callService = new CallService();
export default callService;
