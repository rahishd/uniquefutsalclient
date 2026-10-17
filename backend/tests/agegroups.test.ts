import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";
import { ageOn, dobFilter, inAgeGroup, isValidDob } from "../src/utils/age";
import { todayKey } from "../src/utils/dates";

const POSTER = "9800000931";
const P22 = "9800000932"; // 22 years old
const P33 = "9800000933"; // 33 years old
const NODOB = "9800000934"; // signed up before the date of birth was asked
const SIGNUP = "9800000935";
const ALL = [POSTER, P22, P33, NODOB, SIGNUP];

/** The birth date of someone who is exactly `years` old today. */
const dobFor = (years: number) => {
  const [y, m, d] = todayKey().split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y - years}-${pad(m)}-${pad(m === 2 && d === 29 ? 28 : d)}`;
};

const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wipe() {
  const reqs = await prisma.playerRequest.findMany({ where: { userId: { in: ALL } }, select: { id: true } });
  for (const r of reqs) await prisma.notification.deleteMany({ where: { dedupeKey: { startsWith: `players-${r.id}-` } } });
  await prisma.playerRequest.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.userPrefs.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(POSTER, "Age Poster", { dateOfBirth: dobFor(28) });
  await makeUser(P22, "Twenty Two", { dateOfBirth: dobFor(22) });
  await makeUser(P33, "Thirty Three", { dateOfBirth: dobFor(33) });
  await makeUser(NODOB, "No Birthdate");
});
afterAll(wipe);

describe("age rules (pure)", () => {
  it("counts whole years and puts the boundary age in the upper group", () => {
    expect(ageOn("2000-10-17", "2026-10-17")).toBe(26);
    expect(ageOn("2000-10-18", "2026-10-17")).toBe(25); // birthday is tomorrow
    expect(inAgeGroup(dobFor(20), "15-20", todayKey())).toBe(false);
    expect(inAgeGroup(dobFor(20), "20-25", todayKey())).toBe(true);
    expect(inAgeGroup(dobFor(19), "15-20", todayKey())).toBe(true);
    expect(inAgeGroup(dobFor(39), "35-40", todayKey())).toBe(true);
    expect(inAgeGroup(dobFor(40), "40+", todayKey())).toBe(true);
    expect(inAgeGroup(dobFor(60), "40+", todayKey())).toBe(true);
    expect(inAgeGroup(null, "20-25", todayKey())).toBe(false); // no date of birth: only Open games
    expect(inAgeGroup(null, "open", todayKey())).toBe(true);
  });
  it("accepts only real dates that give a sensible age", () => {
    const t = todayKey();
    expect(isValidDob("2001-02-30", t)).toBe(false);
    expect(isValidDob("2999-01-01", t)).toBe(false);
    expect(isValidDob(dobFor(3), t)).toBe(false);
    expect(isValidDob(dobFor(101), t)).toBe(false);
    expect(isValidDob(dobFor(25), t)).toBe(true);
    expect(isValidDob("not a date", t)).toBe(false);
  });
  it("builds a database filter that matches the same people", () => {
    const t = todayKey();
    for (const years of [14, 15, 19, 20, 24, 25, 29, 30, 34, 35, 39, 40, 55]) {
      for (const g of ["15-20", "20-25", "25-30", "30-35", "35-40", "40+"] as const) {
        const dob = dobFor(years);
        const f = dobFilter(g, t).dateOfBirth!;
        const inDb = dob <= f.lte && (f.gt === undefined || dob > f.gt);
        expect(inDb).toBe(inAgeGroup(dob, g, t));
      }
    }
  });
});

describe("date of birth at sign-up and in the profile", () => {
  it("a customer cannot sign up without a real date of birth", async () => {
    const base = { name: "Sign Up Sam", phoneNumber: SIGNUP, password: "secret1" };
    expect((await api().post("/api/auth/signup").send(base)).status).toBe(400);
    expect((await api().post("/api/auth/signup").send({ ...base, dateOfBirth: "2001-02-30" })).status).toBe(400);
    expect((await api().post("/api/auth/signup").send({ ...base, dateOfBirth: dobFor(2) })).status).toBe(400);
    const ok = await api().post("/api/auth/signup").send({ ...base, dateOfBirth: dobFor(26) });
    expect(ok.status).toBe(201);
    expect((await prisma.user.findUnique({ where: { phoneNumber: SIGNUP } }))?.dateOfBirth).toBe(dobFor(26));
  });

  it("a customer without one can add it once; it cannot be changed after", async () => {
    const dob = dobFor(31);
    const patch = (body: object) => api().patch("/api/me/profile").set(bearer(tokenFor(NODOB))).send(body);
    expect((await patch({ dateOfBirth: "2001-02-30" })).status).toBe(400);
    expect((await patch({ dateOfBirth: dob })).status).toBe(200);
    const prof = await get(NODOB, "/api/me/profile");
    expect(prof.body.data.dateOfBirth).toBe(dob);
    expect(prof.body.data.age).toBe(31);
    expect((await patch({ dateOfBirth: dobFor(20) })).status).toBe(409);
    await prisma.user.update({ where: { phoneNumber: NODOB }, data: { dateOfBirth: null } }); // back to "no date" for the next tests
  });
});

describe("Find Player age groups", () => {
  const DATE = futureDate(3);
  const DATE2 = futureDate(4);
  let groupId = "";

  const noticeFor = async (user: string, id: string) => {
    for (let i = 0; i < 12; i++) {
      const n = await prisma.notification.findFirst({ where: { userId: user, type: "players", href: `/find-player/${id}` } });
      if (n) return n;
      await sleep(200);
    }
    return null;
  };

  it("lists the age groups and refuses an unknown one", async () => {
    const rules = await get(POSTER, "/api/player-requests/rules");
    expect(rules.body.data.ageGroups).toEqual(["open", "15-20", "20-25", "25-30", "30-35", "35-40", "40+"]);
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: 18, players: 2, ageGroup: "10-12" })).status).toBe(400);
  });

  it("an age-group request is sent only to that group", async () => {
    const r = await post(POSTER, "/api/player-requests", { date: DATE, hour: 18, players: 2, ageGroup: "20-25" });
    expect(r.status).toBe(201);
    groupId = r.body.data.id;
    const mine = await noticeFor(P22, groupId);
    expect(mine?.message).toBe("Age Poster needs 2 Players aged 20 to 25 years for Upcoming Game. View the deal");
    await sleep(500);
    expect(await prisma.notification.count({ where: { userId: P33, href: `/find-player/${groupId}` } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: NODOB, href: `/find-player/${groupId}` } })).toBe(0);
  });

  it("only people in the group see it in the list and can join", async () => {
    const seen = async (u: string) => (await get(u, "/api/player-requests")).body.data.some((x: { id: string }) => x.id === groupId);
    expect(await seen(P22)).toBe(true);
    expect(await seen(P33)).toBe(false);
    expect(await seen(NODOB)).toBe(false);
    expect(await seen(POSTER)).toBe(true); // the host always sees their own

    const wrong = await post(P33, `/api/player-requests/${groupId}/join`);
    expect(wrong.status).toBe(403);
    expect(wrong.body.message).toBe("This game is for players aged 20 to 25 years.");
    const none = await post(NODOB, `/api/player-requests/${groupId}/join`);
    expect(none.status).toBe(403);
    expect(none.body.message).toBe("Add your date of birth in your Profile to join age-group games.");

    expect((await get(P33, `/api/player-requests/${groupId}`)).body.data).toMatchObject({ ageGroup: "20-25", eligible: false, needsDob: false });
    expect((await get(NODOB, `/api/player-requests/${groupId}`)).body.data).toMatchObject({ eligible: false, needsDob: true });

    const ok = await post(P22, `/api/player-requests/${groupId}/join`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ joinedByMe: true, eligible: true, spotsLeft: 1 });
  });

  it("an Open request goes to everyone and anyone can join", async () => {
    const r = await post(POSTER, "/api/player-requests", { date: DATE2, hour: 18, players: 2 });
    expect(r.status).toBe(201);
    const id = r.body.data.id;
    for (const u of [P22, P33, NODOB]) expect(await noticeFor(u, id)).not.toBeNull();
    expect((await post(NODOB, `/api/player-requests/${id}/join`)).status).toBe(200);
    expect((await get(P33, `/api/player-requests/${id}`)).body.data.ageGroup).toBe("open");
  });

  it("a request can cover several age groups; a player in any of them is in", async () => {
    const r = await post(POSTER, "/api/player-requests", { date: futureDate(5), hour: 18, players: 2, ageGroups: ["30-35", "20-25", "20-25"] });
    expect(r.status).toBe(201);
    const id = r.body.data.id;
    const row = await prisma.playerRequest.findUnique({ where: { id } });
    expect(row?.ageGroup).toBe("20-25,30-35"); // cleaned, in age order, no repeats
    expect((await get(P22, `/api/player-requests/${id}`)).body.data).toMatchObject({ ageGroups: ["20-25", "30-35"], eligible: true });
    expect((await get(P33, `/api/player-requests/${id}`)).body.data).toMatchObject({ eligible: true }); // 33 is in 30-35
    expect((await get(NODOB, `/api/player-requests/${id}`)).body.data).toMatchObject({ eligible: false, needsDob: true });
    expect((await post(P33, `/api/player-requests/${id}/join`)).status).toBe(200);
  });

  it("Open with other groups counts as Open; a bad group is refused", async () => {
    const r = await post(P22, "/api/player-requests", { date: futureDate(6), hour: 18, players: 1, ageGroups: ["open", "40+"] });
    expect(r.status).toBe(201);
    expect((await get(P33, `/api/player-requests/${r.body.data.id}`)).body.data.ageGroup).toBe("open");
    expect((await post(POSTER, "/api/player-requests", { date: futureDate(6), hour: 19, players: 1, ageGroups: ["10-12"] })).status).toBe(400);
  });
});
