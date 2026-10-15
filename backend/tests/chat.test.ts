import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000801";
const B = "9800000802";
const C = "9800000803";
const D = "9800000804"; // never added anywhere
const ALL = [A, B, C, D];

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
  await makeUser(A, "Chat A");
  await makeUser(B, "Chat B");
  await makeUser(C, "Chat C");
  await makeUser(D, "Chat D");
});
afterAll(wipe);

describe("chat: one to one", () => {
  let thread = "";

  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/chat/threads")).status).toBe(401);
    expect((await api().post("/api/chat/direct").send({ phone: B })).status).toBe(401);
  });

  it("finds customers by the start of a mobile number, never by a short fragment", async () => {
    expect((await get(A, "/api/chat/people?q=980")).body.data).toEqual([]);
    const r = await get(A, "/api/chat/people?q=980000080");
    const phones = r.body.data.map((p: { phone: string }) => p.phone);
    expect(phones).toEqual(expect.arrayContaining([B, C, D]));
    expect(phones).not.toContain(A); // not yourself
  });

  it("opens a chat with another registered customer, once per pair", async () => {
    const first = await post(A, "/api/chat/direct", { phone: B });
    expect(first.status).toBe(200);
    thread = first.body.data.id;
    const again = await post(B, "/api/chat/direct", { phone: A });
    expect(again.body.data.id).toBe(thread);
  });

  it("refuses yourself and numbers that are not registered", async () => {
    expect((await post(A, "/api/chat/direct", { phone: A })).status).toBe(400);
    expect((await post(A, "/api/chat/direct", { phone: "9811999999" })).status).toBe(404);
  });

  it("sends and receives text, and counts unread", async () => {
    const sent = await post(A, `/api/chat/threads/${thread}/messages`, { body: "  Friday 8 PM, are you in?  " });
    expect(sent.status).toBe(201);
    expect(sent.body.data.body).toBe("Friday 8 PM, are you in?");

    const list = await get(B, "/api/chat/threads");
    const row = list.body.data.find((t: { id: string }) => t.id === thread);
    expect(row.title).toBe("Chat A");
    expect(row.unread).toBe(1);
    expect(row.lastMessage).toBe("Friday 8 PM, are you in?");
    expect((await get(B, "/api/chat/unread")).body.data.unread).toBe(1);

    const read = await get(B, `/api/chat/threads/${thread}/messages`);
    expect(read.body.data).toHaveLength(1);
    expect(read.body.data[0].mine).toBe(false);
    expect(read.body.data[0].senderName).toBe("Chat A");
    expect((await get(B, "/api/chat/unread")).body.data.unread).toBe(0);
  });

  it("returns only new messages after a time", async () => {
    const all = (await get(A, `/api/chat/threads/${thread}/messages`)).body.data;
    const last = all[all.length - 1].createdAt as string;
    await post(B, `/api/chat/threads/${thread}/messages`, { body: "Yes, count me in." });
    const fresh = await get(A, `/api/chat/threads/${thread}/messages?after=${encodeURIComponent(last)}`);
    expect(fresh.body.data.map((m: { body: string }) => m.body)).toEqual(["Yes, count me in."]);
  });

  it("checks the message", async () => {
    expect((await post(A, `/api/chat/threads/${thread}/messages`, { body: "   " })).status).toBe(400);
    expect((await post(A, `/api/chat/threads/${thread}/messages`, { body: "x".repeat(1001) })).status).toBe(400);
  });

  it("hides a chat from everyone who is not in it", async () => {
    expect((await get(C, `/api/chat/threads/${thread}`)).status).toBe(404);
    expect((await get(C, `/api/chat/threads/${thread}/messages`)).status).toBe(404);
    expect((await post(C, `/api/chat/threads/${thread}/messages`, { body: "hi" })).status).toBe(404);
  });
});

describe("chat: groups", () => {
  let group = "";
  let invite = "";

  it("creates a group with a name and members; the creator is its admin", async () => {
    expect((await post(A, "/api/chat/groups", { name: "x", members: [B] })).status).toBe(400);
    expect((await post(A, "/api/chat/groups", { name: "Friday Boys", members: ["9811999999"] })).status).toBe(404);
    const r = await post(A, "/api/chat/groups", { name: "Friday Boys", members: [B] });
    expect(r.status).toBe(201);
    group = r.body.data.id;
    const info = (await get(A, `/api/chat/threads/${group}`)).body.data;
    expect(info.kind).toBe("group");
    expect(info.isAdmin).toBe(true);
    expect(info.members.map((m: { phone: string }) => m.phone).sort()).toEqual([A, B]);
    invite = info.inviteCode;
    expect(invite).toMatch(/^[A-Z2-9]{10}$/);
    // a plain member does not see the link
    const asB = (await get(B, `/api/chat/threads/${group}`)).body.data;
    expect(asB.isAdmin).toBe(false);
    expect(asB.inviteCode).toBeNull();
  });

  it("lets every member talk, and shows who said what", async () => {
    await post(B, `/api/chat/threads/${group}/messages`, { body: "Who has the ball?" });
    const seen = (await get(A, `/api/chat/threads/${group}/messages`)).body.data;
    expect(seen[0]).toMatchObject({ body: "Who has the ball?", senderName: "Chat B", mine: false });
  });

  it("lets only a group admin add people", async () => {
    expect((await post(B, `/api/chat/threads/${group}/members`, { phones: [C] })).status).toBe(403);
    const r = await post(A, `/api/chat/threads/${group}/members`, { phones: [C] });
    expect(r.status).toBe(200);
    expect(r.body.data.members).toHaveLength(3);
  });

  it("joins through an invite link", async () => {
    expect((await get(D, "/api/chat/invite/NOTACODE12")).status).toBe(404);
    const preview = await get(D, `/api/chat/invite/${invite}`);
    expect(preview.body.data).toMatchObject({ name: "Friday Boys", memberCount: 3, alreadyIn: false });
    const joined = await post(D, `/api/chat/invite/${invite}/join`);
    expect(joined.body.data.id).toBe(group);
    expect((await get(D, `/api/chat/threads/${group}/messages`)).status).toBe(200);
  });

  it("stops an old link working after it is reset", async () => {
    expect((await post(B, `/api/chat/threads/${group}/invite`)).status).toBe(403);
    const fresh = (await post(A, `/api/chat/threads/${group}/invite`)).body.data.inviteCode;
    expect(fresh).not.toBe(invite);
    expect((await get(D, `/api/chat/invite/${invite}`)).status).toBe(404);
  });

  it("lets an admin remove someone, and a member leave", async () => {
    expect((await del(B, `/api/chat/threads/${group}/members/${C}`)).status).toBe(403);
    expect((await del(A, `/api/chat/threads/${group}/members/${C}`)).status).toBe(200);
    expect((await get(C, `/api/chat/threads/${group}`)).status).toBe(404);
    expect((await del(B, `/api/chat/threads/${group}/members/${B}`)).body.data.left).toBe(true);
  });

  it("keeps an admin: the longest member takes over when the last admin leaves", async () => {
    await del(A, `/api/chat/threads/${group}/members/${A}`);
    const info = (await get(D, `/api/chat/threads/${group}`)).body.data;
    expect(info.members).toHaveLength(1);
    expect(info.isAdmin).toBe(true);
  });

  it("deletes the group when the last person leaves", async () => {
    await del(D, `/api/chat/threads/${group}/members/${D}`);
    expect(await prisma.chatThread.findUnique({ where: { id: group } })).toBeNull();
  });

  it("limits how fast one person can send", async () => {
    const t = (await post(A, "/api/chat/direct", { phone: C })).body.data.id;
    let last = 201;
    for (let i = 0; i < 25; i++) last = (await post(A, `/api/chat/threads/${t}/messages`, { body: `m${i}` })).status;
    expect(last).toBe(429);
  });
});
