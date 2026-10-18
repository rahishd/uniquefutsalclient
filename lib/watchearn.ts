// Watch & Earn: the customer app's side. The server times every ad (15 seconds), counts it and writes the loyalty point
// (40 ads = 1 point); the app only starts an ad, waits, and asks the server to count it (see backend docs/API.md).

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface WERules {
  adSeconds: number;
  adsPerPoint: number;
  pointsPerBlock: number;
  minutesPerPoint: number;
}

export interface WEProgress {
  totalViews: number;
  pointsEarned: number;
  adsTowardNext: number;
  adsLeftForNext: number;
  todayViews: number;
  balance: number;
}

export interface WEMe extends WEProgress {
  rules: WERules;
}

export const RULES: WERules = { adSeconds: 15, adsPerPoint: 40, pointsPerBlock: 1, minutesPerPoint: 10 };

export const watchEarnStore = createRemoteStore<WEMe | null>(() => api<WEMe>("/watch-earn/me"), { signedOut: null });

export const startView = (adId: string | null) =>
  api<{ viewId: string; seconds: number; startedAt: string }>("/watch-earn/views", { method: "POST", body: { adId } });

export const completeView = (viewId: string) =>
  api<WEMe & { counted: boolean; earnedNow: number }>(`/watch-earn/views/${encodeURIComponent(viewId)}/complete`, { method: "POST" });
