"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronLeft, FileText, Loader2, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatRs } from "@/lib/booking";
import { mediaUrl } from "@/lib/content";
import { fmtDay } from "@/lib/promos";
import { ORG_LABEL, verifyCode, type Verified, type VerifyResult } from "@/lib/verify";

// Verify Documents: anyone (no account needed) types the 4-digit code printed on a Unique Futsal bill or document.
// Genuine: the bill or document details are shown. Not genuine: a clear "fake" warning.
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Genuine({ v }: { v: Verified }) {
  return (
    <section aria-live="polite" className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-[0_12px_30px_-18px_rgba(5,150,105,0.5)]">
      <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><ShieldCheck size={24} /></span>
        <div>
          <p className="text-base font-bold text-emerald-800">Genuine</p>
          <p className="text-xs text-emerald-700">Issued by {v.issuedBy} on {when(v.issuedAt)} · Code {v.code}</p>
        </div>
      </div>

      {v.kind === "payment" ? (
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{v.bill.type === "bill" ? "Final bill" : v.bill.type === "gamezone" ? "Gamezone receipt" : "Court booking receipt"}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{v.bill.reference}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-400">Customer</dt><dd className="font-medium">{v.bill.customer}</dd></div>
            <div><dt className="text-xs text-slate-400">Date</dt><dd className="font-medium">{fmtDay(v.bill.date)}{v.bill.time ? `, ${v.bill.time}` : ""}</dd></div>
          </dl>

          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl bg-slate-50 px-4 text-sm">
            {v.bill.lines.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                <span className="text-slate-700">{l.quantity > 1 ? `${l.quantity} x ` : ""}{l.label}</span>
                <span className={`shrink-0 font-medium ${l.amount < 0 ? "text-emerald-600" : ""}`}>{l.amount < 0 ? `- ${formatRs(-l.amount)}` : formatRs(l.amount)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between py-3 text-base font-bold text-slate-900"><span>Total</span><span>{formatRs(v.bill.total)}</span></li>
          </ul>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-slate-400">Transactions</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {v.bill.payments.map((p, i) => (
              <li key={i} className="flex justify-between"><span className="text-slate-600">{p.method}</span><span className="font-medium">{formatRs(p.amount)}</span></li>
            ))}
          </ul>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><BadgeCheck size={14} /> {v.bill.status}</p>
        </div>
      ) : (
        <div className="p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400"><FileText size={14} /> Document</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{v.document.title}</p>
          {v.document.issuedTo && (
            <p className="mt-2 text-sm text-slate-600"><span className="text-slate-400">Issued to:</span> <b className="font-semibold text-slate-800">{v.document.issuedTo}</b>{v.document.orgType ? <span className="text-slate-400"> · {ORG_LABEL[v.document.orgType] ?? v.document.orgType}</span> : null}</p>
          )}
          {v.document.details && <p className="mt-3 whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{v.document.details}</p>}
          {v.document.photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {v.document.photos.map((p) => (
                <a key={p} href={mediaUrl(p)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(p)} alt="Document photo" className="aspect-[4/3] w-full rounded-2xl border border-slate-100 object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Fake({ message, locked }: { message: string; locked: boolean }) {
  return (
    <section role="alert" className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-500 text-white"><ShieldAlert size={24} /></span>
      <div>
        <p className="text-base font-bold text-rose-800">{locked ? "Please wait" : "Not verified: may be fake"}</p>
        <p className="mt-1 text-sm text-rose-700">{message}</p>
        {!locked && <p className="mt-2 text-xs text-rose-600">Check the code again. If it is correct, do not accept the document and contact Unique Futsal.</p>}
      </div>
    </section>
  );
}

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  // /verify?code=4821 opens with the code filled in and checked (for a link or QR on a bill)
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code")?.replace(/\D/g, "").slice(0, 6);
    if (c && c.length >= 4) {
      setCode(c);
      setBusy(true);
      verifyCode(c).then(setResult).finally(() => setBusy(false));
    }
  }, []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.length < 4) return;
    setBusy(true);
    setResult(null);
    setResult(await verifyCode(code));
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-md tab:max-w-xl">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Home</Link>

      <header className="mt-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#0c0b5d] text-white shadow-lg"><ShieldCheck size={28} /></span>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Verify Documents</h1>
        <p className="mt-1 text-sm text-slate-500">Type the verification code printed on a Unique Futsal bill or document to check that it is genuine.</p>
      </header>

      <form onSubmit={check} className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <label htmlFor="verify-code" className="text-sm font-semibold text-slate-700">Verification code</label>
        <input
          id="verify-code"
          value={code}
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="• • • •"
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setResult(null); }}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] tabular-nums text-[#0c0b5d] outline-none focus:border-brand focus:bg-white"
        />
        <button type="submit" disabled={busy || code.length < 4} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#0c0b5d] py-3.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Verify
        </button>
      </form>

      <div className="mt-5">
        {result?.ok === true && <Genuine v={result.data} />}
        {result?.ok === false && <Fake message={result.message} locked={result.reason === "locked"} />}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">The customer&apos;s phone number and account are never shown here.</p>
    </div>
  );
}
