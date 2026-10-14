import { api, futureDate, makeUser, prisma } from "./helpers";

const CAPTAIN = "9800000611";
let open: string; // upcoming, 2 team places
let done: string; // finished

const team = (over: Record<string, unknown> = {}) => ({
  teamName: "Tilottama Strikers",
  captainName: "Ram Thapa",
  contactPhone: "9812345678",
  contactEmail: "",
  players: ["Ram Thapa", "Shyam KC", "Hari Rai", "Gita Sharma", "Sita Magar"],
  ...over,
});

beforeAll(async () => {
  await prisma.registration.deleteMany({ where: { tournament: { name: { startsWith: "REGTEST" } } } });
  await prisma.tournament.deleteMany({ where: { name: { startsWith: "REGTEST" } } });
  await prisma.notification.deleteMany({ where: { userId: CAPTAIN } });
  await prisma.user.deleteMany({ where: { phoneNumber: CAPTAIN } });
  await makeUser(CAPTAIN, "Captain Test");
  open = (await prisma.tournament.create({ data: { name: "REGTEST Cup", prizePool: 5000, minTeams: 2, maxTeams: 2, startDate: futureDate(10), endDate: futureDate(12) } })).id;
  done = (await prisma.tournament.create({ data: { name: "REGTEST Old", prizePool: 0, minTeams: 2, maxTeams: 8, startDate: futureDate(-9), endDate: futureDate(-7), status: "completed" } })).id;
});

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { tournament: { name: { startsWith: "REGTEST" } } } });
  await prisma.tournament.deleteMany({ where: { name: { startsWith: "REGTEST" } } });
  await prisma.notification.deleteMany({ where: { userId: CAPTAIN } });
  await prisma.user.deleteMany({ where: { phoneNumber: CAPTAIN } });
  await prisma.$disconnect();
});

describe("Team registration from the shareable link", () => {
  it("shows what the page needs, without any contact details", async () => {
    const r = await api().get(`/api/tournaments/${open}/registration`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ id: open, name: "REGTEST Cup", open: true, spotsLeft: 2, limit: 2, registered: 0, minPlayers: 5, maxPlayers: 12 });
    expect(JSON.stringify(r.body)).not.toMatch(/contactPhone|captainName/);
    expect((await api().get("/api/tournaments/nope/registration")).status).toBe(404);
  });

  it("registers a team (a guest is enough), then refuses the same name or the same number", async () => {
    const ok = await api().post(`/api/tournaments/${open}/register`).send(team());
    expect(ok.status).toBe(201);
    expect(ok.body.data.status).toBe("pending");
    const row = await prisma.registration.findFirst({ where: { tournamentId: open } });
    expect(JSON.parse(row!.players)).toHaveLength(5);

    const sameName = await api().post(`/api/tournaments/${open}/register`).send(team({ teamName: "tilottama strikers", contactPhone: "9811111111" }));
    expect(sameName.status).toBe(409);
    expect(sameName.body.message).toMatch(/name/i);
    const samePhone = await api().post(`/api/tournaments/${open}/register`).send(team({ teamName: "Other FC" }));
    expect(samePhone.status).toBe(409);
    expect(samePhone.body.message).toMatch(/mobile number/i);
    expect(await prisma.registration.count({ where: { tournamentId: open } })).toBe(1);
  });

  it("checks the form", async () => {
    const post = (b: object) => api().post(`/api/tournaments/${open}/register`).send(b);
    expect((await post(team({ teamName: "A", contactPhone: "9822222222" }))).status).toBe(400);
    expect((await post(team({ contactPhone: "12345", teamName: "Bad Phone FC" }))).status).toBe(400);
    expect((await post(team({ contactPhone: "9833333333", teamName: "Few FC", players: ["One", "Two"] }))).status).toBe(400);
    expect((await post(team({ contactPhone: "9833333333", teamName: "Dup FC", players: ["A A", "A A", "B B", "C C", "D D"] }))).status).toBe(400);
    expect((await post(team({ contactPhone: "9833333333", teamName: "Mail FC", contactEmail: "not-an-email" }))).status).toBe(400);
    expect(await prisma.registration.count({ where: { tournamentId: open } })).toBe(1);
  });

  it("stops when all places are taken, and a rejected team frees its place", async () => {
    expect((await api().post(`/api/tournaments/${open}/register`).send(team({ teamName: "Second FC", contactPhone: "9844444444" }))).status).toBe(201);
    const full = await api().post(`/api/tournaments/${open}/register`).send(team({ teamName: "Third FC", contactPhone: "9855555555" }));
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/places are taken/i);
    const info = await api().get(`/api/tournaments/${open}/registration`);
    expect(info.body.data).toMatchObject({ open: false, spotsLeft: 0 });

    await prisma.registration.updateMany({ where: { tournamentId: open, teamName: "Second FC" }, data: { status: "rejected" } });
    expect((await api().get(`/api/tournaments/${open}/registration`)).body.data.open).toBe(true);
    expect((await api().post(`/api/tournaments/${open}/register`).send(team({ teamName: "Third FC", contactPhone: "9855555555" }))).status).toBe(201);
  });

  it("refuses a finished tournament and an unknown one", async () => {
    const r = await api().post(`/api/tournaments/${done}/register`).send(team({ contactPhone: "9866666666", teamName: "Late FC" }));
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/finished/i);
    expect((await api().post("/api/tournaments/does-not-exist/register").send(team())).status).toBe(404);
  });

  it("tells a customer with an account, and the older endpoint now checks everything too", async () => {
    const t = await prisma.tournament.create({ data: { name: "REGTEST Second", prizePool: 0, minTeams: 2, maxTeams: 8, startDate: futureDate(20), endDate: futureDate(21) } });
    const r = await api().post(`/api/tournaments/${t.id}/register`).send(team({ teamName: "Account FC", contactPhone: CAPTAIN }));
    expect(r.status).toBe(201);
    expect(await prisma.notification.count({ where: { userId: CAPTAIN, type: "tournament" } })).toBe(1);

    const legacyBad = await api().post("/api/tournaments/registrations").send({ tournamentId: t.id, teamName: "x", captainName: "y", contactPhone: "1", players: [] });
    expect(legacyBad.status).toBe(400);
    const legacyOk = await api().post("/api/tournaments/registrations").send({ tournamentId: t.id, ...team({ teamName: "Legacy FC", contactPhone: "9877777777" }) });
    expect(legacyOk.status).toBe(201);
  });
});
