/**
 * Imports the players of the OLD admin system into this database, with their loyalty points.
 *
 *   npx tsx scripts/import-old-players.ts            dry run: shows what it would do, writes nothing
 *   npx tsx scripts/import-old-players.ts --apply    does it
 *
 * Reads backend/migration-data/old-players.json (kept out of git: it holds phone numbers).
 * Rules:
 *  - Every player with a valid mobile number gets an account (name, email, member-since date), guests of the old system too. The password
 *    is a random one nobody knows, so the player sets their own with "Forgot password" (the venue resets it).
 *  - Loyalty points = the old counter x 10 (2/10 = 20 points, 3/10 = 30 ...). They are game points, so they expire like the system's
 *    other game points (3 months from the import day). Run twice and nothing doubles: each player's points entry is unique.
 *  - A number that already has an account here is skipped completely (its account and points are not touched).
 *  - Staff-made placeholder emails (...@manual.com) and emails already used by someone else are not copied.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { HashUtil } from "../src/utils/hash";
import { expiryFor } from "../src/utils/loyaltyPoints";
import { todayKey } from "../src/utils/dates";

dotenv.config();
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

interface OldPlayer {
  name: string; phone: string; email: string; accountType: "registered" | "guest"; memberSince: string;
  matchesPlayed: number; loyaltyCounter: number; loyaltyPoints: number; freeMatchStatus: string;
}

async function main() {
  const file = path.join(__dirname, "..", "migration-data", "old-players.json");
  const players: OldPlayer[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const today = todayKey();
  const existing = new Set((await prisma.user.findMany({ select: { phoneNumber: true } })).map((u) => u.phoneNumber));
  // guests have no account, so a second run finds them through their points entry
  const alreadyImported = new Set((await prisma.loyaltyEntry.findMany({ where: { sourceType: "migration" }, select: { sourceId: true } })).map((e) => e.sourceId));
  const usedEmails =new Set((await prisma.user.findMany({ where: { email: { not: null } }, select: { email: true } })).map((u) => (u.email || "").toLowerCase()));

  const stats = { accountsCreated: 0, guestsPointsOnly: 0, skippedExisting: [] as string[], skippedNoPhone: [] as string[], pointsEntries: 0, pointsTotal: 0, emailsCopied: 0, emailsSkipped: 0 };
  for (const p of players) {
    if (!p.phone) { stats.skippedNoPhone.push(p.name); continue; }
    if (existing.has(p.phone)) { stats.skippedExisting.push(`${p.name} (${p.phone})`); continue; }

    const registered = true; // guests of the old system get an account too
    let email: string | null = null;
    if (p.email) {
      const e = p.email.trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !e.endsWith("@manual.com") && !usedEmails.has(e)) { email = e; usedEmails.add(e); stats.emailsCopied++; } else stats.emailsSkipped++;
    }

    if (apply) {
      await prisma.$transaction(async (tx) => {
        if (registered) {
          await tx.user.create({
            data: {
              phoneNumber: p.phone, name: p.name, email, role: "user", isActive: true, isVerified: false, mustChangePassword: false,
              password: await HashUtil.hash(crypto.randomBytes(24).toString("hex")),
              createdAt: p.memberSince ? new Date(p.memberSince + "T00:00:00+05:45") : new Date(),
            },
          });
        }
        if (p.loyaltyPoints > 0 && !alreadyImported.has(p.phone)) {
          await tx.loyaltyEntry.create({
            data: {
              userId: p.phone, kind: "game", points: new Prisma.Decimal(p.loyaltyPoints.toFixed(1)), earnedOn: today,
              expiresOn: expiryFor("game", today) ?? null, sourceType: "migration", sourceId: p.phone,
              detail: `Imported from our previous system: ${p.loyaltyCounter}/10 matches (${p.matchesPlayed} played in total)`,
            },
          });
        }
      });
    }
    if (registered) stats.accountsCreated++; else stats.guestsPointsOnly++;
    if (p.loyaltyPoints > 0 && !alreadyImported.has(p.phone)) { stats.pointsEntries++; stats.pointsTotal += p.loyaltyPoints; }
  }
  console.log(JSON.stringify({ mode: apply ? "APPLIED" : "DRY RUN (nothing written)", ...stats }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
