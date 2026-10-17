"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { loadRequest, payAdvance, requestsStore, type AdvanceOrder, type PlayerRequest } from "@/lib/playerRequests";
import PaymentQr from "@/components/payment/PaymentQr";
import RequestCard from "@/components/findplayer/RequestCard";

// "View the deal": the page behind the "players needed" notification (/find-player/<id>). For the host it is also the
// page that shows how many players have joined so far (it refreshes by itself) and where the advance is paid.
export default function DealPage({ id }: { id: string }) {
  const session = useSession();
  const registered = session?.registered === true;
  const [r, setR] = useState<PlayerRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<AdvanceOrder | null>(null);
  const [starting, setStarting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadRequest(id).then(setR).catch((e) => setError(errorText(e)));
  }, [id]);

  useEffect(() => {
    if (!registered) return;
    reload();
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
  }, [registered, reload]);

  async function startPayment() {
    setStarting(true);
    setPayError(null);
    try {
      setOrder(await payAdvance(id));
    } catch (e) {
      setPayError(errorText(e));
    } finally {
      setStarting(false);
    }
  }

  if (order) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8 tab:max-w-2xl desk:max-w-2xl desk:pb-16">
        <PaymentQr
          method={order.method}
          orderId={order.orderCode}
          amount={order.amount}
          remarks={order.remarks}
          payload={order.qrPayload}
          expiresAt={order.expiresAt}
          backLabel="Back to the deal"
          onBack={() => {
            setOrder(null);
            reload();
          }}
          onPaid={() => {
            setOrder(null);
            requestsStore.refresh();
            reload();
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 pb-32 pt-8 tab:max-w-2xl desk:max-w-2xl desk:pb-16">
      <Link href="/find-player" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand"><ArrowLeft size={16} /> Find Player</Link>
      <h1 className="text-2xl font-semibold">{r?.mine ? "Your request" : "Players needed"}</h1>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to see this deal</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : error ? (
        <p role="alert" className="glass rounded-3xl p-5 text-center text-sm text-slate-600">{error}</p>
      ) : !r ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" aria-label="Loading" />
      ) : (
        <>
          {r.mine && r.status === "open" && (
            <p className="text-sm text-slate-500">
              Players are being notified. This page updates by itself as people join: <span className="font-semibold text-slate-700">{r.joined} of {r.playersNeeded} so far</span>.
            </p>
          )}
          <RequestCard r={r} detail onChanged={setR} onPayAdvance={startPayment} />
          {starting && <p className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Preparing the payment…</p>}
          {payError && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{payError}</p>}
        </>
      )}
    </main>
  );
}
