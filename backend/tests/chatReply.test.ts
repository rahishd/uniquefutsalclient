import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { allowPushWithoutKeysForTests, setPushSender } from "../src/modules/push/push.service";

const A = "9800000821";
const B = "9800000822";
const C = "9800000823";
const ALL = [A, B, C];

const get = (phone: string, url: string) => api().get(url).set(bearer(tokenFor(phone)));
const post = (phone: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(phone))).send(body);

const pushed: { endpoint: string; payload: { title: string; body: string; href?: string } }[] = [];

async function wipe() {
  const threads = await prisma.chatMember.findMany({ where: { userId: { in: ALL } }, select: { threadId: true } });
  await prisma.chatThread.deleteMany({ where: { id: { in: threads.map((t) => t.threadId) } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Reply A");
  await makeUser(B, "Reply B");
  await makeUser(C, "Reply C");
  allowPushWithoutKeysForTests(true);
  setPushSender(async (sub, payload) => {
    pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  });
  for (const u of [A, B]) {
    await prisma.pushSubscription.create({ data: { userId: u, endpoint: `https://push.test/${u}`, p256dh: "p", auth: "a" } });
  }
});
afterAll(async () => {
  setPushSender(null);
  allowPushWithoutKeysForTests(false);
  await wipe();
  await prisma.$disconnect();
});

const settle = () => new Promise((r) => setTimeout(r, 150)); // the alert is sent after the reply to the sender

describe("chat: replies and message alerts", () => {
  let thread = "";
  let first = "";

  it("a reply carries a short preview of the message it answers", async () => {
    thread = (await post(A, "/api/chat/direct", { phone: B })).body.data.id;
    first = (await post(A, `/api/chat/threads/${thread}/messages`, { body: "k cha khabar" })).body.data.id;
    const reply = (await post(B, `/api/chat/threads/${thread}/messages`, { body: "thik cha", replyTo: first })).body.data;
    expect(reply.replyTo).toMatchObject({ id: first, senderName: "Reply A", body: "k cha khabar", deleted: false });

    const list = (await get(B, `/api/chat/threads/${thread}/messages`)).body.data;
    expect(list.find((m: { id: string }) => m.id === reply.id).replyTo).toMatchObject({ id: first, senderName: "Reply A" });
    expect(list.find((m: { id: string }) => m.id === first).replyTo).toBeNull();
  });

  it("a reply to a deleted message shows no words", async () => {
    await api().delete(`/api/chat/threads/${thread}/messages/${first}`).set(bearer(tokenFor(A)));
    const list = (await get(B, `/api/chat/threads/${thread}/messages`)).body.data;
    const reply = list.find((m: { body: string }) => m.body === "thik cha");
    expect(reply.replyTo).toMatchObject({ id: first, body: "", deleted: true });
  });

  it("cannot reply to a message from another chat or one that does not exist", async () => {
    const other = (await post(A, "/api/chat/direct", { phone: C })).body.data.id;
    const foreign = (await post(A, `/api/chat/threads/${other}/messages`, { body: "private" })).body.data.id;
    expect((await post(B, `/api/chat/threads/${thread}/messages`, { body: "x", replyTo: foreign })).status).toBe(404);
    expect((await post(B, `/api/chat/threads/${thread}/messages`, { body: "x", replyTo: "nope" })).status).toBe(404);
  });

  it("a new message sends a push to the other person's phone, not to the sender", async () => {
    pushed.length = 0;
    await prisma.chatMember.updateMany({ where: { threadId: thread, userId: B }, data: { lastReadAt: new Date(Date.now() - 60_000) } }); // B does not have the chat open
    await post(A, `/api/chat/threads/${thread}/messages`, { body: "are you coming tonight?" });
    await settle();
    expect(pushed).toHaveLength(1);
    expect(pushed[0].endpoint).toBe(`https://push.test/${B}`);
    expect(pushed[0].payload).toMatchObject({ title: "Reply A", body: "are you coming tonight?", href: `/chat/${thread}` });
  });

  it("no push for someone who has the chat open right now", async () => {
    pushed.length = 0;
    await get(B, `/api/chat/threads/${thread}/messages`); // B reads: lastReadAt is now
    await post(A, `/api/chat/threads/${thread}/messages`, { body: "second" });
    await settle();
    expect(pushed).toHaveLength(0);
  });
});
