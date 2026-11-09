import Link from "next/link";
import { BookOpenText, Heart, MapPin, Target, Users } from "lucide-react";
import { site } from "@/lib/site";

// About Us. The write-ups under "Our story", "Our mission" and "Our team" are placeholders: the venue will add them later.
const SECTIONS = [
  { icon: BookOpenText, title: "Our story" },
  { icon: Target, title: "Our mission" },
  { icon: Users, title: "Our team" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      <header className="rounded-3xl bg-white px-5 py-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark-navy.png" alt="" aria-hidden className="mx-auto h-12 w-auto" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">About us</p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-wide text-[#0c0b5d]">{site.name}</h1>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-600"><MapPin size={13} className="shrink-0" aria-hidden /> {site.address}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#dbeafe] px-4 py-1.5 text-xs font-semibold text-[#2c3da0]"><Heart size={13} aria-hidden /> Established 2018</p>
      </header>

      {SECTIONS.map(({ icon: Icon, title }) => (
        <section key={title} aria-label={title} className="rounded-3xl bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#2c3da0]"><Icon size={20} aria-hidden /></span>
            <h2 className="text-lg font-bold text-[#0c0b5d]">{title}</h2>
          </div>
          <p className="mt-3 rounded-2xl bg-[#f3f7ff] px-4 py-6 text-center text-sm text-slate-500">Coming soon.</p>
        </section>
      ))}

      <Link href="/" className="block rounded-full bg-[#dbeafe] py-3 text-center text-sm font-semibold text-[#2c3da0]">Back to Home</Link>
    </div>
  );
}
