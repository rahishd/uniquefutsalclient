"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, Minus, Plus, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { formatRs } from "@/lib/booking";
import { h12, orderStore, placeOrder } from "@/lib/venueorder";
import OrderIcon from "@/components/order/OrderIcon";

// Order at the venue. Open only while the customer's own booked game is on; the server checks that again when the order is placed.
export default function OrderSheet({ onClose }: { onClose: () => void }) {
  const { data, status } = orderStore.use();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ items: string; total: number } | null>(null);

  useEffect(() => {
    void orderStore.refresh();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = data?.items ?? [];
  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const units = lines.reduce((n, i) => n + (qty[i.id] ?? 0), 0);
  const total = lines.reduce((n, i) => n + i.price * (qty[i.id] ?? 0), 0);
  const maxUnits = data?.limits.perOrder ?? 10;

  const change = (id: string, d: number, left: number) =>
    setQty((q) => {
      if (d > 0 && units >= maxUnits) return q;
      return { ...q, [id]: Math.max(0, Math.min(left, (q[id] ?? 0) + d)) };
    });

  async function send() {
    if (busy || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await placeOrder(lines.map((i) => ({ productId: i.id, quantity: qty[i.id] })));
      setDone({ items: r.items, total: r.total });
      setQty({});
    } catch (e) {
      setError(errorText(e));
      void orderStore.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Order at the venue" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-[#f4f6fb] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-brand"><OrderIcon size={22} /></span> Order at the venue
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/70 p-2"><X size={18} /></button>
        </div>

        {done ? (
          <div role="status" className="space-y-3 rounded-2xl bg-white p-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={26} /></span>
            <p className="font-semibold">Order sent</p>
            <p className="text-sm text-slate-600">{done.items}</p>
            <p className="text-sm text-slate-500">
              Staff have been told and will bring it to you. {formatRs(done.total)} is added to your game bill: pay at the counter when your game ends.
            </p>
            <button type="button" onClick={() => setDone(null)} className="glass-btn w-full rounded-full py-3 text-sm font-semibold text-white">Order something else</button>
          </div>
        ) : status !== "ready" && !data ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : !data?.active ? (
          <div className="space-y-2 rounded-2xl bg-white p-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand"><Clock size={22} /></span>
            <p className="font-semibold">Ordering opens during your game</p>
            <p className="text-sm text-slate-500">Only the person who booked a game can order drinks and snacks, from the start of that game until it ends.</p>
            {data?.next ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Your next game: {data.next.date} · {h12(data.next.startTime)} to {h12(data.next.endTime)}
              </p>
            ) : (
              <Link href="/book" onClick={onClose} className="glass-btn mt-2 inline-flex rounded-full px-6 py-2.5 text-sm font-semibold text-white">Book a game</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700">
              Your game is on: {h12(data.active.startTime)} to {h12(data.active.endTime)}. Orders are added to your game bill.
            </p>
            {items.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">Nothing is available to order right now. Please ask at the counter.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => {
                  const n = qty[i.id] ?? 0;
                  return (
                    <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{i.name}</p>
                        <p className="text-xs text-slate-500">{formatRs(i.price)} per {i.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Fewer ${i.name}`} disabled={n === 0} onClick={() => change(i.id, -1, i.left)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700 disabled:opacity-40"><Minus size={14} /></button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">{n}</span>
                        <button type="button" aria-label={`More ${i.name}`} disabled={n >= i.left || units >= maxUnits} onClick={() => change(i.id, 1, i.left)} className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white disabled:opacity-40"><Plus size={14} /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <button type="button" onClick={send} disabled={busy || lines.length === 0} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {lines.length === 0 ? "Choose what you want" : `Order ${units} item${units > 1 ? "s" : ""} · ${formatRs(total)}`}
            </button>
            <p className="text-center text-xs text-slate-400">Pay at the counter with your game. Up to {maxUnits} items per order.</p>
          </div>
        )}
      </div>
    </div>
  );
}
