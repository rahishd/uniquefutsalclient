// Ordering drinks and snacks at the venue (Mineral Water Bottle, Frooty...) while playing a booked game. The server decides everything:
// who may order (the registered customer who booked the game that is on), which products are shown (staff switch them on in the
// admin Inventory page), the stock and the price. Orders become a pay-later due on the customer's account, paid with the game bill.
import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface OrderGame {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  left: number;
}
export interface OrderState {
  active: OrderGame | null; // the customer's game that is on right now
  next: OrderGame | null; // their next game
  limits: { perItem: number; perOrder: number };
  items: OrderItem[];
}

// refreshed every 30 seconds so the icon knows when the game starts or ends
export const orderStore = createRemoteStore<OrderState | null>(() => api<OrderState>("/venue-orders/current"), { signedOut: null, pollMs: 30_000 });

export async function placeOrder(items: { productId: string; quantity: number }[]) {
  const r = await api<{ id: string; items: string; total: number; game: OrderGame }>("/venue-orders", { method: "POST", body: { items } });
  await orderStore.refresh();
  return r;
}

export const h12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
