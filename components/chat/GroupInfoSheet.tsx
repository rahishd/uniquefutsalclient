"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, RefreshCw, Search, UserMinus, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { MIN_SEARCH_DIGITS, addMembers, inviteLink, removeMember, resetInvite, searchPeople, threadsStore, type ChatInfo, type ChatPerson } from "@/lib/chat";
import ProfileAvatar from "@/components/captain/ProfileAvatar";

// Group details: who is in it, add people, the invite link (admins), leave. The server checks every action again.
export default function GroupInfoSheet({ info, onClose, onChanged }: { info: ChatInfo; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ChatPerson[]>([]);
  const [code, setCode] = useState(info.inviteCode);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = q.replace(/\D/g, "");
  const searching = info.isAdmin && digits.length >= MIN_SEARCH_DIGITS;
  const inGroup = new Set(info.members.map((m) => m.phone));
  const shown = searching ? found.filter((p) => !inGroup.has(p.phone)) : [];
  const link = code ? inviteLink(code) : "";

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

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const add = (p: ChatPerson) =>
    run(async () => {
      await addMembers(info.id, [p.phone]);
      setQ("");
      onChanged();
    });

  const remove = (phone: string, name: string) =>
    run(async () => {
      if (!(await askConfirm(`Remove ${name} from this group?`))) return;
      await removeMember(info.id, phone);
      onChanged();
    });

  const leave = () =>
    run(async () => {
      if (!(await askConfirm("Leave this group? You will stop receiving its messages."))) return;
      await removeMember(info.id, info.members.find((m) => m.you)!.phone);
      threadsStore.refresh();
      router.push("/chat");
    });

  const newLink = () =>
    run(async () => {
      if (!(await askConfirm("Make a new invite link? The old link will stop working."))) return;
      setCode((await resetInvite(info.id)).inviteCode);
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the link is shown for copying by hand
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Group info"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{info.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
        </div>

        {info.isAdmin && code && (
          <section className="mt-4 rounded-2xl bg-blue-50 p-4">
            <p className="text-sm font-semibold text-brand">Invite link</p>
            <p className="mt-1 break-all text-xs text-slate-600">{link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="glass-btn flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join our group "${info.title}" on Unique Futsal: ${link}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-xs font-semibold text-white"
              >
                <FaWhatsapp size={14} /> Share
              </a>
              <button type="button" onClick={newLink} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                <RefreshCw size={13} /> New link
              </button>
            </div>
          </section>
        )}

        {info.isAdmin && (
          <section className="mt-4">
            <label className="block text-sm font-medium">
              Add a player
              <span className="relative mt-1 block">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  inputMode="numeric"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Mobile number"
                  className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm outline-none"
                />
              </span>
            </label>
            <ul className="mt-2 space-y-2">
              {shown.map((p) => (
                <li key={p.phone}>
                  <button type="button" onClick={() => add(p)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-left">
                    <ProfileAvatar name={p.name} captain={false} size={36} src={p.avatar} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.phone}</span>
                    </span>
                    <span className="text-xs font-semibold text-brand">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">{info.members.length} people</p>
        <ul className="mt-2 space-y-2">
          {info.members.map((m) => (
            <li key={m.phone} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
              <ProfileAvatar name={m.name} captain={false} size={36} src={m.avatar} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{m.you ? `${m.name} (you)` : m.name}</span>
                <span className="block text-xs text-slate-500">{m.role === "admin" ? "Group admin" : m.phone}</span>
              </span>
              {info.isAdmin && !m.you && (
                <button type="button" onClick={() => remove(m.phone, m.name)} aria-label={`Remove ${m.name}`} className="rounded-full p-2 text-red-600">
                  <UserMinus size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <button type="button" onClick={leave} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-red-200 py-3 text-sm font-semibold text-red-600">
          <LogOut size={16} /> Leave group
        </button>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
