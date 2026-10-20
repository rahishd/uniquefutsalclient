import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { allowPushWithoutKeysForTests, setPushSender } from "../src/modules/push/push.service";

const A = "9800000831";
const B = "9800000832";
const C = "9800000833";
const D = "9800000834";
const ALL = [A, B, C, D];
const SDP = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";

const get = (phone: string, url: string) => api().get(url).set(bearer(tokenFor(phone)));
const post = (phone: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(phone))).send(body);

const pushed: { endpoint: string; payload: { title: string; body: string; href?: string } }[] = [];

async function wipe() {
  const threads = await prisma.chatMember.findMany({ where: { userId: { in: ALL } }, select: { threadId: true } });
  await prisma.chatThread.deleteMany({ where: { id: { in: threads.map((t) => t.threadId) } } });
  await prisma.chatCall.deleteMany({ where: { OR: [{ callerId: { in: ALL } }, { calleeId: { in: ALL } }] } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Call A");
  await makeUser(B, "Call B");
  await makeUser(C, "Call C");
  await makeUser(D, "Call D");
  allowPushWithoutKeysForTests(true);
  setPushSender(async (sub, payload) => {
    pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  });
  await prisma.pushSubscription.create({ data: { userId: B, endpoint: `https://push.test/${B}`, p256dh: "p", auth: "a" } });
});
afterAll(async () => {
  setPushSender(null);
  allowPushWithoutKeysForTests(false);
  await wipe();
  await prisma.$disconnect();
});

const settle = () => new Promise((r) => setTimeout(r, 150));

describe("chat: voice calls", () => {
  let thread = "";
  let callId = "";

  it("signed-out people and the ice servers route", async () => {
    expect((await api().get("/api/chat/calls/incoming")).status).toBe(401);
    const ice = (await get(A, "/api/chat/calls/ice")).body.data.iceServers;
    expect(Array.isArray(ice) && ice.length).toBeTruthy();
  });

  it("a call rings the other person and sends them a phone alert", async () => {
    thread = (await post(A, "/api/chat/direct", { phone: B })).body.data.id;
    const res = await post(A, "/api/chat/calls", { threadId: thread, offer: SDP });
    expect(res.status).toBe(201);
    callId = res.body.data.id;
    await settle();
    expect(pushed).toHaveLength(1);
    expect(pushed[0].payload).toMatchObject({ title: "Call A", body: "Incoming voice call", href: `/chat/${thread}` });

    const ringing = (await get(B, "/api/chat/calls/incoming")).body.data;
    expect(ringing).toMatchObject({ id: callId, threadId: thread, from: "Call A", offer: SDP });
    expect((await get(A, "/api/chat/calls/incoming")).body.data).toBeNull(); // the caller is not rung
  });

  it("only the two people can see the call", async () => {
    expect((await get(C, `/api/chat/calls/${callId}`)).status).toBe(404);
    expect((await post(C, `/api/chat/calls/${callId}/end`)).status).toBe(404);
  });

  it("both people are busy while it rings, and a stranger cannot call into the chat", async () => {
    expect((await post(A, "/api/chat/calls", { threadId: thread, offer: SDP })).status).toBe(409);
    const other = (await post(C, "/api/chat/direct", { phone: B })).body.data.id;
    expect((await post(C, "/api/chat/calls", { threadId: other, offer: SDP })).status).toBe(409); // B is being rung
    expect((await post(D, "/api/chat/calls", { threadId: thread, offer: SDP })).status).toBe(404); // D is not in this chat
  });

  it("only the person being called can answer; the caller then gets the answer", async () => {
    expect((await post(A, `/api/chat/calls/${callId}/answer`, { answer: SDP })).status).toBe(403);
    expect((await get(A, `/api/chat/calls/${callId}`)).body.data).toMatchObject({ status: "ringing", answer: null });

    expect((await post(B, `/api/chat/calls/${callId}/answer`, { answer: SDP })).status).toBe(200);
    expect((await get(A, `/api/chat/calls/${callId}`)).body.data).toMatchObject({ status: "active", answer: SDP });
    expect((await get(B, `/api/chat/calls/${callId}`)).body.data.answer).toBeNull(); // the callee already has what they sent
    expect((await get(B, "/api/chat/calls/incoming")).body.data).toBeNull(); // no longer ringing
    expect((await post(B, `/api/chat/calls/${callId}/answer`, { answer: SDP })).status).toBe(409);
  });

  it("either person can hang up, twice is harmless, and the line is free afterwards", async () => {
    expect((await post(B, `/api/chat/calls/${callId}/end`)).body.data.status).toBe("ended");
    expect((await post(A, `/api/chat/calls/${callId}/end`)).body.data.status).toBe("ended");
    expect((await get(A, `/api/chat/calls/${callId}`)).body.data.status).toBe("ended");
    expect((await post(A, "/api/chat/calls", { threadId: thread, offer: SDP })).status).toBe(201);
  });

  it("declining and giving up are recorded; an unanswered call becomes missed", async () => {
    const ringing = (await get(B, "/api/chat/calls/incoming")).body.data.id;
    expect((await post(B, `/api/chat/calls/${ringing}/end`)).body.data.status).toBe("declined");

    const second = (await post(A, "/api/chat/calls", { threadId: thread, offer: SDP })).body.data.id;
    expect((await post(A, `/api/chat/calls/${second}/end`)).body.data.status).toBe("missed");

    const third = (await post(A, "/api/chat/calls", { threadId: thread, offer: SDP })).body.data.id;
    await prisma.chatCall.update({ where: { id: third }, data: { createdAt: new Date(Date.now() - 60_000) } });
    expect((await get(A, `/api/chat/calls/${third}`)).body.data.status).toBe("missed");
    expect((await get(B, "/api/chat/calls/incoming")).body.data).toBeNull();
  });

  it("calls are for direct chats and need a real offer", async () => {
    const group = (await post(A, "/api/chat/groups", { name: "Call group", members: [B, C] })).body.data.id;
    expect((await post(A, "/api/chat/calls", { threadId: group, offer: SDP })).status).toBe(400);
    expect((await post(A, "/api/chat/calls", { threadId: thread, offer: "x" })).status).toBe(400);
  });
});
