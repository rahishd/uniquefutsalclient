"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, CheckCircle2, Gift, Loader2, Star, UserRound } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { MAX_ADVANCE_DAYS, dateKey, fetchSlots, formatRs, type Slot } from "@/lib/booking";
import { clock, dayLabel } from "@/lib/refer";
import {
  FALLBACK_RULES, POINT_PACKS, STATUS_TEXT, findFriend, giftGame, giftPoints, loadGiftRules, loadGifts, quoteGiftGame,
  type GameQuote, type GiftFriend, type GiftOrder, type GiftRules, type GiftView,
} from "@/lib/gift";
import PaymentQr from "@/components/payment/PaymentQr";

type Option = "points" | "game";

const input = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";
const chip = (on: boolean) => `rounded-2xl px-3 py-2.5 text-xs font-medium ${on ? "glass-active text-white" : "bg-white/70 text-slate-600"}`;

// Gift Card: buy loyalty points for a friend, or book and pay a game in the friend's name instead.
export default function GiftCardPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const [rules, setRules] = useState<GiftRules>(FALLBACK_RULES);
  const [gifts, setGifts] = useState<GiftView[] | null>(null);
  const [option, setOption] = useState<Option | null>(null);

  // friend
  const [phone, setPhone] = useState("");
  const [friend, setFriend] = useState<GiftFriend | null>(null);
  const [finding, setFinding] = useState(false);

  // points
  const [points, setPoints] = useState<number>(50);

  // game
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startTime, setStartTime] = useState("");
  const [quote, setQuote] = useState<GameQuote | null>(null);

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{ payment: GiftOrder; gift: GiftView } | null>(null);
  const [done, setDone] = useState<GiftView | null>(null);

  useEffect(() => { loadGiftRules().then(setRules).catch(() => {}); }, []);
  const refresh = useCallback(() => loadGifts().then((r) => { setGifts(r.gifts); setRules(r.rules); }).catch(() => setGifts([])), []);
  useEffect(() => { if (registered) refresh(); }, [registered, refresh]);

  const pickDate = useCallback((d: string) => {
    setDate(d);
    setStartTime("");
    setQuote(null);
    setSlots(null);
    setError(null);
    fetchSlots(d).then(setSlots).catch((e) => { setSlots([]); setError(errorText(e)); });
  }, []);

  // the price of the chosen hour for this friend (their club or VIP discount counts)
  useEffect(() => {
    if (option !== "game" || !friend || !date || !startTime) return;
    let live = true;
    quoteGiftGame({ friendPhone: friend.phone, date, startTime })
      .then((q) => live && setQuote(q))
      .catch((e) => live && setError(errorText(e)));
    return () => { live = false; };
  }, [option, friend, date, startTime]);

  async function find() {
    setError(null);
    setFinding(true);
    try {
      setFriend(await findFriend(phone));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setFinding(false);
    }
  }

  async function pay() {
    if (!friend) return;
    setError(null);
    setBusy(true);
    try {
      const note = message.trim() || undefined;
      const r = option === "points"
        ? await giftPoints({ friendPhone: friend.phone, points, message: note })
        : await giftGame({ friendPhone: friend.phone, date, startTime, message: note });
      setOrder(r);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setOption(null);
    setPhone("");
    setFriend(null);
    setPoints(50);
    setDate("");
    setSlots(null);
    setStartTime("");
    setQuote(null);
    setMessage("");
    setError(null);
    setDone(null);
  }

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><Gift size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Gift Card</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Buy loyalty points for a friend, or book and pay a game in their name. Sign in to start.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  if (order) {
    return (
      <div className="mx-auto w-full max-w-md tab:max-w-2xl desk:max-w-2xl">
        <PaymentQr
          method={order.payment.method}
          orderId={order.payment.orderCode}
          amount={order.payment.amount}
          remarks={order.payment.remarks}
          payload={order.payment.qrPayload}
          expiresAt={order.payment.expiresAt}
          backLabel="Back to Gift Card"
          onBack={() => { setOrder(null); refresh(); }}
          onPaid={() => { setDone(order.gift); setOrder(null); refresh(); }}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Gift sent</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          {done.kind === "points"
            ? `${done.points} loyalty points were added to ${done.otherName}'s account. We let them know in the app.`
            : `The game on ${done.game ? `${dayLabel(done.game.date)}, ${clock(done.game.startTime)}` : "the chosen day"} is booked for ${done.otherName}. We let them know in the app.`}
        </p>
        <button type="button" onClick={reset} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Done</button>
      </div>
    );
  }

  const pointsOk = Number.isInteger(points) && points >= rules.minPoints && points <= rules.maxPoints;
  const total = option === "points" ? (pointsOk ? points * rules.rsPerPoint : 0) : quote?.total ?? 0;
  const ready = !!friend && (option === "points" ? pointsOk : !!quote && quote.total > 0);

  return (
    <div className="space-y-6 pb-4 desk:mx-auto desk:max-w-3xl">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Gift size={26} className="text-brand" /> Gift Card</h1>
        <p className="mt-1 text-sm text-slate-500">Give a friend something to play with. They need an account in this app.</p>
      </header>

      <section aria-label="Options" className="grid gap-3 desk:grid-cols-2">
        <OptionCard
          on={option === "points"}
          onClick={() => { setOption("points"); setError(null); }}
          icon={<Star size={22} />}
          title="Buy Loyalty Points for my friend"
          text={`Rs. ${rules.rsPerPoint} a point. They can spend them on a free game.`}
        />
        <OptionCard
          on={option === "game"}
          onClick={() => { setOption("game"); setError(null); }}
          icon={<CalendarDays size={22} />}
          title="Book Game Instead"
          text="Pick the day and time. The game is booked in your friend's name and you pay for it."
        />
      </section>

      {option && (
        <form onSubmit={(e) => { e.preventDefault(); if (ready) pay(); }} className="glass space-y-5 rounded-3xl p-5" aria-label={option === "points" ? "Buy points for a friend" : "Book a game for a friend"}>
          <div>
            <label className="block text-sm font-medium">1. Your friend&apos;s mobile number
              <div className="flex gap-2">
                <input value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setFriend(null); setQuote(null); }} inputMode="numeric" autoComplete="off" placeholder="98XXXXXXXX" className={input} />
                <button type="button" onClick={find} disabled={phone.length !== 10 || finding || !!friend} className="mt-2 shrink-0 rounded-2xl bg-[#0c0b5d] px-4 text-sm font-semibold disabled:opacity-50" style={{ color: "#ffffff" }}>
                  {finding ? <Loader2 size={16} className="animate-spin" /> : "Find"}
                </button>
              </div>
            </label>
            {friend && <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700"><UserRound size={16} /> Sending to {friend.firstName} <Check size={16} /></p>}
          </div>

          {friend && option === "points" && (
            <div>
              <p className="text-sm font-medium">2. How many points?</p>
              <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Points">
                {POINT_PACKS.map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={points === p} onClick={() => setPoints(p)} className={chip(points === p)}>{p}</button>
                ))}
              </div>
              <label className="mt-3 block text-xs text-slate-500">Or type an amount ({rules.minPoints} to {rules.maxPoints})
                <input value={Number.isFinite(points) ? String(points) : ""} onChange={(e) => setPoints(parseInt(e.target.value.replace(/\D/g, "").slice(0, 3) || "0", 10))} inputMode="numeric" className={input} />
              </label>
              {!pointsOk && <p className="mt-1 text-xs text-rose-600">Choose between {rules.minPoints} and {rules.maxPoints} points.</p>}
            </div>
          )}

          {friend && option === "game" && (
            <>
              <div>
                <p className="text-sm font-medium">2. Pick a date</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Date">
                  {Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return dateKey(d); }).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={date === k} onClick={() => pickDate(k)} className={`shrink-0 ${chip(date === k)}`}>{dayLabel(k)}</button>
                  ))}
                </div>
              </div>
              {date && (
                <div>
                  <p className="text-sm font-medium">3. Pick a time (1 hour)</p>
                  {slots === null ? (
                    <div className="mt-2 h-12 animate-pulse rounded-2xl bg-white/50" aria-label="Loading times" />
                  ) : slots.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No free times on this date. Try another day.</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time">
                      {slots.map((sl) => (
                        <button key={sl.startTime} type="button" role="radio" aria-checked={startTime === sl.startTime} onClick={() => { setStartTime(sl.startTime); setQuote(null); setError(null); }} className={chip(startTime === sl.startTime)}>
                          {clock(sl.startTime)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {ready && (
            <>
              <label className="block text-sm font-medium">Message (optional)
                <input value={message} onChange={(e) => setMessage(e.target.value.slice(0, 120))} maxLength={120} placeholder="Happy birthday! Enjoy the game." className={input} />
              </label>
              <dl className="space-y-1.5 rounded-2xl bg-white/60 px-4 py-3 text-sm">
                {option === "points" ? (
                  <div className="flex justify-between"><dt>{points} points × Rs. {rules.rsPerPoint}</dt><dd>{formatRs(total)}</dd></div>
                ) : quote && (
                  <>
                    <div className="flex justify-between"><dt>{dayLabel(quote.date)}, {clock(quote.startTime)} · 1 hour</dt><dd>{formatRs(quote.basePrice)}</dd></div>
                    {quote.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{friend!.firstName}&apos;s discount</dt><dd>− {formatRs(quote.discount)}</dd></div>}
                  </>
                )}
                <div className="flex justify-between border-t border-white/60 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatRs(total)}</dd></div>
              </dl>
            </>
          )}

          {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

          {ready && (
            <>
              <button type="submit" disabled={busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : `Pay ${formatRs(total)} with Fonepay`}
              </button>
              <p className="text-center text-xs text-slate-400">
                {option === "points" ? "The points reach your friend as soon as the payment arrives." : "The hour is held for 10 minutes while you pay. Your friend gets the booking as soon as the payment arrives."} Up to {rules.perDay} gifts a day.
              </p>
            </>
          )}
        </form>
      )}

      <section aria-label="My gifts" className="space-y-3">
        <h2 className="text-lg font-medium">My gifts</h2>
        {gifts === null && <div className="h-20 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
        {gifts?.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
            <Gift size={28} className="text-slate-400" /> No gifts yet.
          </div>
        )}
        <ul className="space-y-3">
          {gifts?.map((g) => {
            const st = STATUS_TEXT[g.status];
            const what = g.kind === "points" ? `${g.points} loyalty points` : g.game ? `a game on ${dayLabel(g.game.date)}, ${clock(g.game.startTime)}` : "a game";
            return (
              <li key={g.id} className="glass space-y-1 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{g.role === "sent" ? `You gave ${g.otherName} ${what}` : `${g.otherName} gave you ${what}`}</p>
                  {g.role === "sent" && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>}
                </div>
                {g.message && <p className="text-sm italic text-slate-600">&ldquo;{g.message}&rdquo;</p>}
                <p className="text-xs text-slate-400"><span className="font-mono">{g.code}</span>{g.role === "sent" ? ` · ${formatRs(g.amount)}` : ""}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function OptionCard({ on, onClick, icon, title, text }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`glass flex items-start gap-3 rounded-3xl p-4 text-left transition ${on ? "ring-2 ring-brand" : ""}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-brand">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}
