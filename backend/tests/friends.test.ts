import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000811";
const B = "9800000812";
const C = "9800000813";
const ALL = [A, B, C];

const get = (phone: string, url: string) => api().get(url).set(bearer(tokenFor(phone)));
const post = (phone: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(phone))).send(body);
const del = (phone: string, url: string) => api().delete(url).set(bearer(tokenFor(phone)));

async function wipe() {
  await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: { in: ALL } }, { addresseeId: { in: ALL } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Friend A");
  await makeUser(B, "Friend B");
  await makeUser(C, "Friend C");
});
afterAll(wipe);

describe("friends", () => {
  let requestId = "";

  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/chat/friends")).status).toBe(401);
    expect((await api().post("/api/chat/friends/request").send({ phone: B })).status).toBe(401);
  });

  it("sends a request to a registered customer, not to yourself or a stranger", async () => {
    expect((await post(A, "/api/chat/friends/request", { phone: A })).status).toBe(400);
    expect((await post(A, "/api/chat/friends/request", { phone: "9800000899" })).status).toBe(404);
    const r = await post(A, "/api/chat/friends/request", { phone: B });
    expect(r.status).toBe(201);
    requestId = r.body.data.id;
    expect((await post(A, "/api/chat/friends/request", { phone: B })).status).toBe(409);
  });

  it("shows the request to both sides, and only the receiver can accept", async () => {
    const mine = (await get(A, "/api/chat/friends")).body.data;
    expect(mine.outgoing).toHaveLength(1);
    const theirs = (await get(B, "/api/chat/friends")).body.data;
    expect(theirs.incoming).toHaveLength(1);
    expect(theirs.incoming[0].from.phone).toBe(A);
    expect((await post(A, `/api/chat/friends/${requestId}/accept`)).status).toBe(404);
    expect((await post(C, `/api/chat/friends/${requestId}/accept`)).status).toBe(404);
    expect((await post(B, `/api/chat/friends/${requestId}/accept`)).status).toBe(200);
  });

  it("lists accepted friends for both people", async () => {
    expect((await get(A, "/api/chat/friends")).body.data.friends.map((f: { phone: string }) => f.phone)).toEqual([B]);
    expect((await get(B, "/api/chat/friends")).body.data.friends.map((f: { phone: string }) => f.phone)).toEqual([A]);
    expect((await post(B, "/api/chat/friends/request", { phone: A })).status).toBe(409);
  });

  it("asking someone who already asked you makes you friends at once", async () => {
    await post(C, "/api/chat/friends/request", { phone: A });
    const r = await post(A, "/api/chat/friends/request", { phone: C });
    expect(r.body.data.status).toBe("accepted");
  });

  it("either side can remove a friend, and a stranger cannot", async () => {
    const id = (await get(A, "/api/chat/friends")).body.data.friends.find((f: { phone: string }) => f.phone === B).id;
    expect((await del(C, `/api/chat/friends/${id}`)).status).toBe(404);
    expect((await del(B, `/api/chat/friends/${id}`)).status).toBe(200);
    expect((await get(A, "/api/chat/friends")).body.data.friends.map((f: { phone: string }) => f.phone)).toEqual([C]);
  });
});
