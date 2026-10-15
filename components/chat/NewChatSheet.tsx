"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserRound, Users, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { GROUP_NAME_MAX, MIN_SEARCH_DIGITS, createGroup, openDirect, searchPeople, threadsStore, type ChatPerson } from "@/lib/chat";
import ProfileAvatar from "@/components/captain/ProfileAvatar";

// Bottom sheet to start a one to one chat or make a group. Customers are found by the start of their mobile number.
export default function NewChatSheet({ initialMode, onClose }: { initialMode: "direct" | "group"; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"direct" | "group">(initialMode);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ChatPerson[]>([]);
  const [picked, setPicked] = useState<ChatPerson[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = q.replace(/\D/g, "");
  const searching = digits.length >= MIN_SEARCH_DIGITS;
  const shown = searching ? found : [];

  useEffect(() => {
    if (!searching) return;
    let live = true;
    const t = setTimeout(() => {
      searchPeople(digits).then((r) => live && setFound(r)).catch(() => live && setFound([]));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [digits, searching]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function startDirect(p: ChatPerson) {
    setBusy(true);
    setError(null);
    try {
      const { id } = await openDirect(p.phone);
      threadsStore.refresh();
      router.push(`/chat/${id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function makeGroup() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await createGroup(name.trim(), picked.map((p) => p.phone));
      threadsStore.refresh();
      router.push(`/chat/${id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const toggle = (p: ChatPerson) => setPicked((l) => (l.some((x) => x.phone === p.phone) ? l.filter((x) => x.phone !== p.phone) : [...l, p]));

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "direct" ? "New chat" : "New group"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === "direct" ? "New chat" : "New group"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-medium">
          <button type="button" onClick={() => setMode("direct")} className={`rounded-full py-2 ${mode === "direct" ? "glass-active" : "text-slate-500"}`}>
            <UserRound size={14} className="mr-1 inline" /> One to one
          </button>
          <button type="button" onClick={() => setMode("group")} className={`rounded-full py-2 ${mode === "group" ? "glass-active" : "text-slate-500"}`}>
            <Users size={14} className="mr-1 inline" /> Group
          </button>
        </div>

        {mode === "group" && (
          <label className="mt-4 block text-sm font-medium">
            Group name
            <input
              value={name}
              maxLength={GROUP_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Night Boys"
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
            />
          </label>
        )}

        <label className="mt-4 block text-sm font-medium">
          {mode === "direct" ? "Find a player by mobile number" : "Add players by mobile number"}
          <span className="relative mt-1 block">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              inputMode="numeric"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="98XXXXXXXX"
              className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm outline-none"
            />
          </span>
        </label>
        <p className="mt-1 text-xs text-slate-400">Type at least {MIN_SEARCH_DIGITS} digits. Only registered Unique Futsal players are found.</p>

        {searching && shown.length === 0 && <p className="mt-3 text-sm text-slate-500">No registered player found with that number.</p>}
        <ul className="mt-3 space-y-2">
          {shown.map((p) => {
            const on = picked.some((x) => x.phone === p.phone);
            return (
              <li key={p.phone}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (mode === "direct" ? startDirect(p) : toggle(p))}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left ${on ? "border-brand bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  <ProfileAvatar name={p.name} captain={false} size={40} src={p.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-slate-500">{p.phone}</span>
                  </span>
                  {mode === "group" && <span className="text-xs font-semibold text-brand">{on ? "Added" : "Add"}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {mode === "group" && (
          <>
            {picked.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">In this group ({picked.length + 1})</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {picked.map((p) => (
                    <li key={p.phone} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-xs font-medium text-brand">
                      {p.name}
                      <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.name}`} className="rounded-full p-1"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              disabled={busy || name.trim().length < 2}
              onClick={makeGroup}
              className="glass-btn mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />} Create group
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">You can also add people later with an invite link.</p>
          </>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
