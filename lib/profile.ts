// The customer's profile and payment history, from the server (GET/PATCH /me/profile, GET /me/payments).

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import { updateSessionAvatar, updateSessionName } from "@/lib/session";

export interface Profile {
  customerCode: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null; // path of the profile picture, or null when there is none
  location: string | null;
  position: string | null; // GK | DEF | MID | FWD
  registeredAt: string;
  status: "Active" | "Suspended";
  mode: "player" | "captain";
}

export const POSITIONS: { value: string; label: string }[] = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
];

export const profileStore = createRemoteStore<Profile | null>(() => api<Profile>("/me/profile"), { signedOut: null });

export async function saveProfile(p: { name: string; email: string; location: string; position: string }) {
  await api("/me/profile", { method: "PATCH", body: { name: p.name, email: p.email, location: p.location, position: p.position || null } });
  updateSessionName(p.name);
  await profileStore.refresh();
}

// Profile picture. The photo is cropped to a centred square and shrunk in the browser first (a canvas keeps pixels only, so
// location data is dropped); the server checks and re-encodes it again.
export async function squarePhoto(file: File, side = 480): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Please choose a JPG, PNG or WebP picture.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That picture could not be opened. Try a different one.");
  }
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(side, s);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the picture.");
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function uploadAvatar(image: string) {
  const r = await api<{ avatar: string }>("/me/profile/avatar", { method: "PUT", body: { image } });
  updateSessionAvatar(r.avatar);
  await profileStore.refresh();
}

export async function removeAvatar() {
  await api("/me/profile/avatar", { method: "DELETE" });
  updateSessionAvatar(null);
  await profileStore.refresh();
}

// One line of a final bill made at the venue counter: a game, or goods such as water.
export interface BillLine {
  type: "game" | "goods";
  label: string;
  quantity: number;
  amount: number;
}

export interface PaymentItem {
  id: string;
  kind: "game" | "gamezone" | "bill";
  lines?: BillLine[]; // bills only
  points?: number; // loyalty points earned from this bill
  date: string;
  time: string;
  code: string; // short booking code to show
  amount: number;
  method: string;
  status: string;
}

export const paymentsStore = createRemoteStore<PaymentItem[]>(() => api<PaymentItem[]>("/me/payments"), { signedOut: [] });

export interface GameplayGame {
  id: string;
  code: string;
  date: string;
  time: string;
  goals: number | null; // null = never recorded (older games)
  assists: number | null;
}
export interface Gameplay {
  totals: { games: number; goals: number; assists: number; withStats: number };
  games: GameplayGame[];
}

// Games played with goals and assists (staff record them for new games; older games have none).
export const gameplayStore = createRemoteStore<Gameplay | null>(() => api<Gameplay>("/me/gameplay"), { signedOut: null });
