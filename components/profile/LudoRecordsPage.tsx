"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { ludoStore } from "@/lib/ludo";
import { LudoFrame } from "@/components/ludo/parts";
import { GameHistory, LudoLeaderboard, LudoStats } from "@/components/ludo/Records";

// Profile > Unique Ludo Game: everything the player has done in Unique Ludo in one place: totals, every finished game
// (older ones load with "Show older games") and the leaderboard. The game itself is at /ludo.
export default function LudoRecordsPage() {
  const session = useSession();
  const router = useRouter();
  const registered = session?.registered === true;
  const me = ludoStore.use().data ?? null;

  // /profile/ludo#leaderboard (the View Leaderboard button on the game screen) opens scrolled to the leaderboard
  useEffect(() => {
    if (!registered || window.location.hash !== "#leaderboard") return;
    const h = setTimeout(() => document.getElementById("leaderboard")?.scrollIntoView({ block: "start" }), 350);
    return () => clearTimeout(h);
  }, [registered]);

  return (
    <LudoFrame title="Unique Ludo Game" subtitle="My game records" back={() => router.push("/profile")}>
      <div className="lu-scroll">
        <div className="lu-wrap grid gap-4 pb-8 pt-1">
          {!registered ? (
            <section className="lu-panel p-5 text-center" aria-label="Sign in">
              <p className="font-extrabold">Sign in to see your Unique Ludo records</p>
              <p className="lu-muted mt-1 text-sm">Your games, statistics and the leaderboard are kept on your account.</p>
              <button type="button" className="lu-btn mt-4" onClick={openSignIn}>Sign in</button>
            </section>
          ) : (
            <>
              <section className="lu-panel flex items-center justify-between gap-3 p-4" aria-label="Play">
                <div>
                  <p className="lu-h2 !mb-0.5">Your Loyalty Points</p>
                  <p className="text-3xl font-black lu-gold" aria-live="polite">{me ? me.balance : "…"}</p>
                </div>
                <Link href="/ludo" className="lu-btn small"><Play size={14} /> Play now</Link>
              </section>

              {me && me.stats.played > 0
                ? <LudoStats stats={me.stats} />
                : <section className="lu-panel p-4" aria-label="Your statistics"><p className="lu-h2">Your statistics</p><p className="lu-muted text-sm">No finished games yet. Play a game and your totals will show here.</p></section>}

              <GameHistory pageSize={20} paged refreshKey={me?.recent[0]?.id} />
              <LudoLeaderboard />
            </>
          )}
        </div>
      </div>
    </LudoFrame>
  );
}
