import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000811";
const B = "9800000812";
const C = "9800000813";
const ALL = [A, B, C];

const get = (phone: string, url: string) => api().get(url).set(bearer(tokenFor(phone)));
const post = (phone: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(phone))).send(body);
const del = (phone: string, url: string) => api().delete(url).set(bearer(tokenFor(phone)));

async function wipe() {
  const threads = await prisma.chatMember.findMany({ where: { userId: { in: ALL } }, select: { threadId: true } });
  await prisma.chatThread.deleteMany({ where: { id: { in: threads.map((t) => t.threadId) } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Receipt A");
  await makeUser(B, "Receipt B");
  await makeUser(C, "Receipt C");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const ahead = () => new Promise((r) => setTimeout(r, 15)); // so message times differ from read times

describe("chat: seen and delete", () => {
  let thread = "";
  let first = "";
  let second = "";

  it("a message is unseen until the other person opens the chat", async () => {
    thread = (await post(A, "/api/chat/direct", { phone: B })).body.data.id;
    await ahead();
    first = (await post(A, `/api/chat/threads/${thread}/messages`, { body: "k xa khabar" })).body.data.id;
    await ahead();

    const before = (await get(A, `/api/chat/threads/${thread}/status`)).body.data;
    const sentAt = new Date((await prisma.chatMessage.findUniqueOrThrow({ where: { id: first } })).createdAt).getTime();
    expect(before.reads).toHaveLength(1);
    expect(new Date(before.reads[0]).getTime()).toBeLessThan(sentAt); // B has not opened it
    expect((await get(A, "/api/chat/threads")).body.data[0]).toMatchObject({ lastSeen: false });
    expect((await get(B, "/api/chat/threads")).body.data[0].lastSeen).toBeNull(); // not B's own message

    await get(B, `/api/chat/threads/${thread}/messages`); // B opens the chat
    const after = (await get(A, `/api/chat/threads/${thread}/status`)).body.data;
    expect(new Date(after.reads[0]).getTime()).toBeGreaterThanOrEqual(sentAt);
    expect((await get(A, "/api/chat/threads")).body.data[0]).toMatchObject({ lastSeen: true });
  });

  it("only members can read the status", async () => {
    expect((await get(C, `/api/chat/threads/${thread}/status`)).status).toBe(404);
    expect((await api().get(`/api/chat/threads/${thread}/status`)).status).toBe(401);
  });

  it("the sender can delete a message: the words are erased for everyone", async () => {
    await ahead();
    second = (await post(A, `/api/chat/threads/${thread}/messages`, { body: "oops wrong chat" })).body.data.id;
    const res = await del(A, `/api/chat/threads/${thread}/messages/${second}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: second, deleted: true });

    for (const who of [A, B]) {
      const rows = (await get(who, `/api/chat/threads/${thread}/messages`)).body.data;
      const gone = rows.find((m: { id: string }) => m.id === second);
      expect(gone).toMatchObject({ body: "", deleted: true });
      expect(rows.find((m: { id: string }) => m.id === first)).toMatchObject({ body: "k xa khabar", deleted: false });
    }
    const raw = await prisma.chatMessage.findUniqueOrThrow({ where: { id: second } });
    expect(raw.body).toBe(""); // really erased, not just hidden
    expect((await get(B, `/api/chat/threads/${thread}/status`)).body.data.deleted).toEqual([second]);
    expect((await get(A, "/api/chat/threads")).body.data[0].lastMessage).toBe("This message was deleted");
  });

  it("deleting again is harmless, and a deleted message does not count as unread", async () => {
    expect((await del(A, `/api/chat/threads/${thread}/messages/${second}`)).status).toBe(200);
    await ahead();
    const third = (await post(A, `/api/chat/threads/${thread}/messages`, { body: "this one goes too" })).body.data.id;
    expect((await get(B, "/api/chat/unread")).body.data.unread).toBe(1);
    await del(A, `/api/chat/threads/${thread}/messages/${third}`);
    expect((await get(B, "/api/chat/unread")).body.data.unread).toBe(0);
  });

  it("nobody can delete someone else's message, or one that is not in this chat", async () => {
    await ahead();
    const bs = (await post(B, `/api/chat/threads/${thread}/messages`, { body: "mine, B" })).body.data.id;
    expect((await del(A, `/api/chat/threads/${thread}/messages/${bs}`)).status).toBe(403);
    expect((await del(C, `/api/chat/threads/${thread}/messages/${bs}`)).status).toBe(404); // not a member
    expect((await del(A, `/api/chat/threads/${thread}/messages/nope`)).status).toBe(404);
    expect((await api().delete(`/api/chat/threads/${thread}/messages/${bs}`)).status).toBe(401);
    const other = (await post(A, "/api/chat/direct", { phone: C })).body.data.id;
    expect((await del(B, `/api/chat/threads/${other}/messages/${bs}`)).status).toBe(404);
    expect((await get(A, `/api/chat/threads/${thread}/messages`)).body.data.find((m: { id: string }) => m.id === bs).deleted).toBe(false);
  });

  it("in a group, seen needs every other member to have opened the chat", async () => {
    const g = (await post(A, "/api/chat/groups", { name: "Seen Group", members: [B, C] })).body.data.id;
    await ahead();
    await post(A, `/api/chat/threads/${g}/messages`, { body: "match at 7" });
    await ahead();
    await get(B, `/api/chat/threads/${g}/messages`);
    const row = (ts: { id: string; lastSeen: boolean | null }[]) => ts.find((t) => t.id === g)!;
    expect(row((await get(A, "/api/chat/threads")).body.data).lastSeen).toBe(false); // C has not opened it yet
    await get(C, `/api/chat/threads/${g}/messages`);
    expect(row((await get(A, "/api/chat/threads")).body.data).lastSeen).toBe(true);
    expect((await get(A, `/api/chat/threads/${g}/status`)).body.data.reads).toHaveLength(2);
  });
});
