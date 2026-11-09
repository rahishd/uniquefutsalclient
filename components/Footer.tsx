"use client";

import BackToTop from "@/components/BackToTop";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Mail, MapPin, Navigation, PhoneCall, Leaf, Smartphone, Banknote } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";
import PartnersStrip from "@/components/PartnersStrip";
import GoogleReview from "@/components/GoogleReview";
import Facilities from "@/components/Facilities";


// a round light-blue tile with a one-colour (navy) icon
function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  const cls = `flex h-8 w-8 items-center justify-center rounded-full text-[15px] bg-[#dbeafe] text-[#2c3da0] transition active:scale-95`;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls}>
      {children}
    </a>
  ) : (
    <span aria-label={`${label} (link coming soon)`} className={`${cls} opacity-70`}>
      {children}
    </span>
  );
}

const GOOGLE_MAP = site.mapLink;
const APPLE_MAP = `https://maps.apple.com/?ll=${site.mapLat},${site.mapLng}&q=${encodeURIComponent(site.name)}`;

// A tap opens the maps app on the phone: Apple Maps on Apple devices, otherwise Google Maps (the link also works in a browser).
function openMaps(e: React.MouseEvent<HTMLAnchorElement>) {
  if (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)) { e.preventDefault(); window.open(APPLE_MAP, "_blank", "noopener,noreferrer"); }
}

const LINKS = [
  { title: "Quick Links", items: [{ label: "Book a court", href: "/book" }, { label: "Gamezone", href: "/gamezone" }, { label: "Membership", href: "/member" }, { label: "Tournaments", href: "/tournaments" }] },
  { title: "About", items: [{ label: "About Us", href: "/about" }, { label: "Rules & Regulations", href: "/rules" }, { label: "Help", href: "/help" }, { label: "Complaints", href: "/complaints" }] },
  { title: "Updates", items: [{ label: "Promos", href: "/promos" }, { label: "Points", href: "/points" }, { label: "Refer & Earn", href: "/refer" }, { label: "Children's Academy", href: "/academy" }] },
];

const heading = "text-xs font-bold uppercase tracking-[0.2em] text-[#0c0b5d]";

export default function Footer() {
  const [openGroup, setOpenGroup] = useState(""); // which footer dropdown is open
  const [more, setMore] = useState(false); // the founder message: short by default, "Read More" shows the rest
  const t = useT();
  return (
    <footer className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+83px)] pt-5 tab:max-w-3xl tab:px-8 desk:max-w-none desk:px-10 desk:pb-[26px] desk:pt-5">
      {/* the organisations the venue works with: between the promo codes above and the founder message */}
      <PartnersStrip />

      {/* what the venue offers, between Corporate Network and the founder message */}
      <Facilities />

      <section aria-label="A message from the founder" className="glass mb-10 overflow-hidden rounded-3xl">
        <div className="relative bg-slate-100 text-slate-700">

          <div className="relative grid desk:grid-cols-[1.55fr_1fr]">
            <div className="space-y-3 px-6 pb-6 pt-16 text-sm leading-relaxed desk:px-12 desk:pb-12 desk:pt-24 desk:text-[17px] desk:leading-8">
              <h2 className="text-xl font-bold text-slate-900 desk:text-3xl">A Message from the Founder</h2>
              <p className="font-semibold text-slate-900">Greetings to our valued customers, players, and well-wishers,</p>
              <p>My vision began in 2017 with a simple yet meaningful goal: to create a futsal facility that offers more than just a place to play. Established in 2018, Unique Futsal was built on the values of comfort, refreshment, innovation, and a welcoming, family-like environment—The name &quot;Unique&quot; was born since then.</p>
              {more && (<>
              <p>Our journey has been driven by continuous improvement and a commitment to our community. In 2019, we introduced health insurance to support players against unexpected injuries. In 2021, we launched dedicated membership plans for men, women, and corporate groups. In 2023, we established our Children&apos;s Academy for ages 10–15, promoting football skills, physical fitness, and discipline. In 2024, we introduced GameZone, extending the experience beyond the court.</p>
              <p>In 2025, we launched our 3% Charity Initiative, transforming my childhood dream of helping those in need into meaningful action. A portion of the profit generated through games contributes to supporting underprivileged children with food, shelter, and education. We believe every game can create an opportunity to make a difference. Every Game you play contributes 3% to them.</p>
              <p>Looking ahead, I envision Unique Futsal becoming a technology-driven sports destination, offering seamless online booking and integrated digital services. As a Computing graduate from London Metropolitan University, I am personally developing our booking system, combining my passion for technology with my commitment to improving the customer experience.</p>
              <p>To me, futsal is more than a sport. It builds teamwork, encourages a healthy lifestyle, develops discipline, and brings people together. Our ambition is to continue creating experiences that inspire players while contributing positively to society.</p>
              <p>Thank you for your continued trust, support, and loyalty. Unique Futsal is more than a venue—it is a community built on shared passion, meaningful connections, and a vision for a better future.</p>
              </>)}
              <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#0c0b5d] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(12,11,93,0.8)] transition active:scale-95">
                {more ? t("Show less") : t("Read More")}
                {more ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

            </div>

            {/* a cut-out photo (transparent background), standing on the bottom edge of the card */}
            <div className="relative flex items-end justify-center px-6 desk:px-0 desk:pr-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/founder.webp" alt="Rahish Dumre, Founder of Unique Futsal" className="block w-3/4 max-w-[340px] object-contain object-bottom desk:w-full desk:max-w-[460px]" />
            </div>

          </div>
        </div>

        <div className="bg-white px-6 py-4 text-center desk:px-12 desk:py-6">
          <span className="block text-xs font-medium uppercase tracking-[0.25em] text-slate-500 desk:text-sm">Founder</span>
          <span className="mt-0.5 block text-xl font-semibold tracking-wide text-slate-900 desk:text-3xl">Rahish Dumre</span>
        </div>
      </section>


      {/* ask for a Google review, with a one-time loyalty point for registered customers (components/GoogleReview.tsx) */}
      <GoogleReview />

      {/* Find us: right under the Google review */}
      <div className="mt-10">
        <h2 className={heading}>{t("Find us")}</h2>
        <a href={GOOGLE_MAP} onClick={openMaps} target="_blank" rel="noopener noreferrer" aria-label={`Track ${site.name} on the map`}
          className="relative mt-3 block overflow-hidden rounded-2xl bg-gradient-to-br from-[#eaf3ff] via-[#dbeaff] to-[#cbe0ff] p-3.5 text-[#0c0b5d] shadow-[0_14px_28px_-16px_rgba(59,130,246,0.5)] ring-2 ring-white/80 transition active:scale-[0.98]">
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white opacity-70 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full border border-white/70" />
          <span aria-hidden className="pointer-events-none absolute -bottom-6 -left-2 h-16 w-16 rounded-full border border-white/70" />
          <div className="relative flex items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#3345b0]/15 motion-reduce:animate-none" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3345b0] shadow-[0_5px_12px_-6px_rgba(51,69,176,0.5)] ring-2 ring-white"><MapPin size={20} /></span>
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#3345b0]"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live location</p>
              <p className="text-base font-bold leading-tight">{site.name}</p>
              <p className="text-[11px] leading-snug text-[#334155]">{site.address}</p>
            </div>
          </div>
          <span className="relative mt-3 flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold shadow-[0_4px_10px_-6px_rgba(59,130,246,0.6)] ring-1 ring-white" style={{ color: "#2c3da0" }}>
            <Navigation size={14} /> {t("Track us")} <span aria-hidden>→</span>
          </span>
        </a>
      </div>

      {/* the site map: one dropdown at a time */}
      <nav aria-label="Footer links" className="mt-10 rounded-3xl border border-[#e8ebf2] bg-white px-5 py-1 desk:px-8">
        {LINKS.map((g, i) => {
          const open = openGroup === g.title;
          return (
            <div key={g.title} className={i > 0 ? "border-t border-[#eef0f6]" : ""}>
              <button type="button" onClick={() => setOpenGroup(open ? "" : g.title)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-4 text-left text-base font-bold text-[#0c0b5d]">
                {t(g.title)}
                <ChevronDown size={18} aria-hidden className={`shrink-0 text-[#3345b0] transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <ul className="list-disc space-y-2.5 pb-4 pl-5 marker:text-[#3345b0]">
                  {g.items.map((l) => (
                    <li key={l.href} className="pl-1 text-sm font-medium"><Link href={l.href} className="text-[#2c3da0]">{t(l.label)}</Link></li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Connect with us: compact, one card */}
      <section aria-label="Connect with us" className="mt-6 rounded-3xl border border-[#e8ebf2] bg-white p-4 desk:p-6">
        <h2 className={heading}>{t("Connect with us")}</h2>
        <ul className="mt-3 space-y-2 text-sm font-medium text-slate-700">
          <li><a href={`tel:${site.phone}`} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2c3da0]"><PhoneCall size={16} /></span>{site.phone}</a></li>
          <li><a href={`mailto:${site.email}`} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2c3da0]"><Mail size={16} /></span><span className="break-all">{site.email}</span></a></li>
          <li className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2c3da0]"><MapPin size={16} /></span><span className="leading-snug">{site.address}</span></li>
        </ul>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eef0f6] pt-3">
          <p className="text-xs font-medium text-slate-500">{t("Connect with our Social Media Profile")}</p>
          <div className="flex shrink-0 gap-1.5">
            <Social href={site.whatsapp} label="WhatsApp"><FaWhatsapp /></Social>
            <Social href={site.facebook} label="Facebook"><FaFacebookF className="text-sm" /></Social>
            <Social href={site.instagram} label="Instagram"><FaInstagram /></Social>
            <Social href={site.tiktok} label="TikTok"><FaTiktok className="text-sm" /></Social>
          </div>
        </div>
      </section>

    {/* Go Digital Go Paperless section */}
    <section aria-label="Environmental commitment" className="mt-6 rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200">
      <div className="space-y-2.5">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2.5">
            <Smartphone size={18} className="text-[#0c0b5d]" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#0c0b5d]">Go Digital</h3>
              <p className="text-[11px] text-[#0c0b5d] font-semibold">Go Paperless</p>
            </div>
          </div>
          <div className="h-7 w-px bg-slate-300" />
          <div className="flex items-center gap-2.5">
            <Leaf size={18} className="text-[#0c0b5d]" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#0c0b5d]">Save</h3>
              <p className="text-[11px] text-[#0c0b5d] font-semibold">Environment</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-2.5">
          <p className="text-center text-[10.5px] leading-snug text-[#0c0b5d]">At Unique Futsal, we believe in making everyday operations smarter and easier through digital technology. From bookings and payments to records and daily management, we handle almost everything digitally, reducing the need for paper and printed documents while creating a more efficient, eco-friendly, and sustainable environment.</p>
        </div>
      </div>
    </section>

    {/* the ways to pay: the wallets we take today, cash at the venue, and card payment (a mobile POS) coming soon */}
    <section aria-label="We accept" className="mt-3 rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200">
      <h3 className="text-center text-xs font-medium uppercase tracking-wide text-[#0c0b5d]">We Accept (For Nepalese)</h3>
      <ul className="mt-2.5 flex items-start gap-2">
        <li className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full min-w-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 h-11">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pay-fonepay.webp" alt="" aria-hidden className="h-6 w-auto max-w-full object-contain" />
          </div>
          <span className="text-[11px] font-bold text-[#0c0b5d]">Fonepay</span>
        </li>
        <li className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full min-w-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 h-11">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pay-esewa.webp" alt="" aria-hidden className="h-6 w-auto max-w-full object-contain" />
          </div>
          <span className="text-[11px] font-bold text-[#0c0b5d]">eSewa</span>
        </li>
        <li className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full min-w-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 h-11 gap-1.5 text-[#0c0b5d]">
            <Banknote size={22} strokeWidth={1.8} aria-hidden />
          </div>
          <span className="text-[11px] font-bold text-[#0c0b5d]">Cash</span>
        </li>
      </ul>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="text-center text-[11px] font-medium uppercase tracking-wide text-[#0c0b5d]">For Indian and foreign players</p>
        <ul className="mt-2 flex items-start gap-2">
          {[["/pay-phonepe.webp", "PhonePe", "h-7"], ["/pay-upi.webp", "UPI", "h-7"], ["/pay-gpay.webp", "Google Pay", "h-5"], ["/pay-stripe.webp", "Stripe", "h-5"]].map(([src, name, h]) => (
            <li key={name} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex w-full min-w-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 h-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" aria-hidden className={`${h} w-auto max-w-full object-contain`} />
              </div>
              <span className="text-[11px] font-bold text-[#0c0b5d]">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>

      {/* two rows: the brand and "Since 2018" in the middle, then the copyright (left) and the credit (right), two short lines each */}
      <div className="mt-3 flex justify-end">
        <BackToTop />
      </div>
      <div className="mt-3 border-t-2 border-[#0c0b5d]/25 pt-[26px]">
        <div className="flex items-center justify-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-navy.png" alt="" aria-hidden className="h-8 w-auto" />
          <span className="text-lg font-extrabold uppercase leading-tight tracking-wide text-brand">{site.name}</span>
          <span className="border-l border-slate-300 pl-2.5 text-xs font-medium text-slate-600">Since 2018</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1.5 whitespace-nowrap px-1 text-[8px] text-slate-600 desk:text-xs desk:font-medium">
          <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p>{t("Designed & Developed by")} <span className="font-semibold text-[#0c0b5d]">Rahish Dumre</span></p>
        </div>
      </div>
    </footer>
  );
}
