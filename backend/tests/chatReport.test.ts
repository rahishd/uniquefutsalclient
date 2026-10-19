import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000821"; // reports
const B = "9800000822"; // wrote the message
const C = "9800000823"; // not in the chat
const ALL = [A, B, C];

const get = (phone: string, url: string) => api().get(url).set(bearer(tokenFor(phone)));
const post = (phone: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(phone))).send(body);
const del = (phone: string, url: string) => api().delete(url).set(bearer(tokenFor(phone)));

async function wipe() {
  const threads = await prisma.chatMember.findMany({ where: { userId: { in: ALL } }, select: { threadId: true } });
  await prisma.chatThread.deleteMany({ where: { id: { in: threads.map((t) => t.threadId) } } });
  await prisma.complaint.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Report A");
  await makeUser(B, "Report B");
  await makeUser(C, "Report C");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("chat: report a message", () => {
  let thread = "";
  let theirs = "";
  let mine = "";
  const url = (id: string) => `/api/chat/threads/${thread}/messages/${id}/report`;

  beforeAll(async () => {
    thread = (await post(A, "/api/chat/direct", { phone: B })).body.data.id;
    theirs = (await post(B, `/api/chat/threads/${thread}/messages`, { body: "you are useless, send money now" })).body.data.id;
    mine = (await post(A, `/api/chat/threads/${thread}/messages`, { body: "hello" })).body.data.id;
  });

  it("lists the reasons for signed-in customers", async () => {
    expect((await api().get("/api/chat/report-reasons")).status).toBe(401);
    const r = await get(A, "/api/chat/report-reasons");
    expect(r.status).toBe(200);
    expect(r.body.data.reasons.map((x: { id: string }) => x.id)).toContain("harassment");
  });

  it("files a complaint the venue can read, with who, where and what", async () => {
    const res = await post(A, url(theirs), { reason: "harassment", note: "He keeps doing this" });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^CP-/);
    const c = await prisma.complaint.findFirstOrThrow({ where: { userId: A, category: "chat" } });
    expect(c.status).toBe("open");
    expect(c.message).toContain("Harassment or bullying");
    expect(c.message).toContain(`Report B (${B})`);
    expect(c.message).toContain("you are useless, send money now");
    expect(c.message).toContain("He keeps doing this");
    expect(c.message).toContain(theirs); // the reference an admin can match to the message
  });

  it("does not take the same message twice", async () => {
    const again = await post(A, url(theirs), { reason: "spam" });
    expect(again.status).toBe(409);
    expect(await prisma.complaint.count({ where: { userId: A, category: "chat" } })).toBe(1);
  });

  it("refuses your own message, a missing reason, an outsider and a deleted message", async () => {
    expect((await post(A, url(mine), { reason: "spam" })).status).toBe(400);
    const second = (await post(B, `/api/chat/threads/${thread}/messages`, { body: "another one" })).body.data.id;
    expect((await post(A, url(second), { reason: "nonsense" })).status).toBe(400);
    expect((await post(A, url(second), {})).status).toBe(400);
    expect((await post(C, url(second), { reason: "spam" })).status).toBe(404); // not in this chat
    expect((await get(C, `/api/chat/threads/${thread}/messages`)).status).toBe(404);
    expect((await del(B, `/api/chat/threads/${thread}/messages/${second}`)).status).toBe(200);
    expect((await post(A, url(second), { reason: "spam" })).status).toBe(409); // already deleted by the sender
    expect((await api().post(url(second)).send({ reason: "spam" })).status).toBe(401);
  });

  it("shows up in the same list staff read for complaints", async () => {
    const staff = await prisma.complaint.findMany({ where: { category: "chat", userId: A } });
    expect(staff).toHaveLength(1);
  });
});
