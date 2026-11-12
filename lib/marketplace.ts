// Partner Marketplace (customer side): businesses that have an agreement with Unique Futsal (cafes, swimming pools ...) and give our customers
// a discount for loyalty points. The server decides which partners are live (agreement dates, on/off) and what each discount costs in points;
// the app only shows them and asks to redeem. Redeeming spends points and gives a card with a code to show at the partner.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface PartnerOffer { id: string; title: string; discountText: string; pointsCost: number; maxPerCustomer: number | null }
export interface MarketPartner { id: string; name: string; category: string; about: string | null; bannerUrl: string | null; bannerSeconds: number; validUntil: string; offers: PartnerOffer[] }
export interface PartnerCard {
  id: string; cardCode: string; status: "active" | "used" | "cancelled"; points: number; createdAt: string; usedAt: string | null;
  partner: string; category: string; validUntil: string; bannerUrl: string | null; offerTitle: string; discountText: string; discountCode: string;
}
export interface LoyaltyCard {
  name: string; phone: string; memberSince: string; balance: number;
  earned: { id: string; kind: string; points: number; on: string; detail: string; expiresOn: string | null }[];
}

// public: the Home tile and the banners need the list before sign-in
export const partnersStore = createRemoteStore<MarketPartner[]>(() => api<MarketPartner[]>("/marketplace", { auth: "none" }), { pollMs: 60_000 });
export const cardsStore = createRemoteStore<PartnerCard[]>(() => api<PartnerCard[]>("/marketplace/cards"), { signedOut: [], pollMs: 30_000 });
export const loyaltyCardStore = createRemoteStore<LoyaltyCard | null>(() => api<LoyaltyCard>("/marketplace/loyalty-card"), { signedOut: null, pollMs: 30_000 });

export async function redeemOffer(offerId: string) {
  const card = await api<PartnerCard>(`/marketplace/offers/${encodeURIComponent(offerId)}/redeem`, { method: "POST" });
  await Promise.allSettled([cardsStore.refresh(), loyaltyCardStore.refresh()]);
  return card;
}

export const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const KIND_LABEL: Record<string, string> = { game: "Game", captain_win: "Challenge win", goods: "Goods", membership: "Membership", referral: "Refer & Earn", goal_rush: "Goal Rush", gift: "Gift", watch_earn: "Watch & Earn", review: "Review", shared_in: "Shared with you" };
