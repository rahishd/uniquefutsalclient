"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, MapPin, Navigation, PhoneCall, Leaf, Smartphone } from "lucide-react";
import { FaFacebookF, FaGoogle, FaInstagram, FaStar, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";
import PartnersStrip from "@/components/PartnersStrip";
import Facilities from "@/components/Facilities";


// a round brand-coloured tile with a white icon; `bg` is the brand colour (or gradient) and `glow` its soft shadow
function Social({ href, label, bg, glow, children }: { href: string; label: string; bg: string; glow: string; children: React.ReactNode }) {
  const cls = `flex h-12 w-12 items-center justify-center rounded-full text-[22px] text-white ring-2 ring-white/70 transition active:scale-95 ${bg} ${glow}`;
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

const heading = "text-xs font-bold uppercase tracking-[0.2em] text-[#0c0b5d]";

export default function Footer() {
  const [more, setMore] = useState(false); // the founder message: short by default, "Read More" shows the rest
  const t = useT();
  return (
    <footer className="mx-auto w-full max-w-md px-5 pb-28 pt-6 tab:max-w-3xl tab:px-8 desk:max-w-none desk:px-10 desk:pb-14 desk:pt-6">
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


      {/* ask for a Google review: plain text; any star (or the link) opens the venue's Google review form */}
      <section aria-label="Review us on Google" className="mt-10">
        <h2 className={heading}>{t("How was your experience?")}</h2>
        <p className="mt-4 text-sm text-slate-500">{t("Tell others about Unique Futsal with a quick Google review.")}</p>
        <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#eaf3ff] via-[#dbeaff] to-[#cbe0ff] p-3.5 text-center shadow-[0_14px_28px_-16px_rgba(59,130,246,0.5)] ring-1 ring-[#bfd7ff]">
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white opacity-70 blur-3xl" />
          <div className="relative flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <a key={n} href={site.googleReview} target="_blank" rel="noopener noreferrer" aria-label={`Rate us ${n} star${n > 1 ? "s" : ""} on Google`} className="rounded-full p-1 text-[26px] text-[#fbbc05] drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)] transition active:scale-90">
                <FaStar />
              </a>
            ))}
          </div>
          <a href={site.googleReview} target="_blank" rel="noopener noreferrer" className="relative mt-2 flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold transition active:scale-[0.98]" style={{ color: "#2c3da0" }}>
            <FaGoogle size={13} className="text-[#4285f4]" /> {t("Write a Google review")} <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      <div className="mt-10 space-y-10 desk:grid desk:grid-cols-2 desk:gap-10 desk:space-y-0">
        <div>
          <h2 className={heading}>{t("Connect with us")}</h2>
          <ul className="mt-4 space-y-3 text-sm font-medium text-slate-600">
            <li>
              <a href={`tel:${site.phone}`} className="flex items-center gap-3">
                <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500">
                  <PhoneCall size={18} />
                </span>
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="flex items-center gap-3">
                <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500">
                  <Mail size={18} />
                </span>
                <span className="break-all">{site.email}</span>
              </a>
            </li>
            <li className="flex items-center gap-3">
              <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500">
                <MapPin size={18} />
              </span>
              {site.address}
            </li>
          </ul>
          <div className="mt-5 border-t border-slate-200/80 pt-4">
            <p className="text-sm font-medium text-slate-600">{t("Connect with our Social Media Profile")}</p>
          <div className="mt-3 flex gap-3">
            <Social href={site.whatsapp} label="WhatsApp" bg="bg-gradient-to-br from-[#3be07a] to-[#12a150]" glow="shadow-[0_8px_16px_-6px_rgba(18,161,80,0.7)]">
              <FaWhatsapp />
            </Social>
            <Social href={site.facebook} label="Facebook" bg="bg-gradient-to-br from-[#3b8bff] to-[#1250c8]" glow="shadow-[0_8px_16px_-6px_rgba(24,119,242,0.7)]">
              <FaFacebookF className="text-xl" />
            </Social>
            <Social href={site.instagram} label="Instagram" bg="bg-gradient-to-tr from-[#f9a825] via-[#e1306c] to-[#7b3fe4]" glow="shadow-[0_8px_16px_-6px_rgba(225,48,108,0.7)]">
              <FaInstagram />
            </Social>
            <Social href={site.tiktok} label="TikTok" bg="bg-gradient-to-br from-[#2a2a33] to-black" glow="shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)]">
              <FaTiktok className="text-xl" />
            </Social>
          </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Go Digital Go Paperless section */}
          <section aria-label="Environmental commitment" className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200">
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

          <div>
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
        </div>
      </div>


      <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-navy.png" alt="" aria-hidden className="h-9 w-auto" />
          <span className="text-base font-extrabold uppercase leading-tight tracking-wide text-brand">{site.name}</span>
        </div>
        <p className="text-right text-xs text-slate-500">{t("Designed & Developed by")}:<br /><span className="font-semibold text-[#0c0b5d]">Rahish Dumre</span></p>
      </div>
    </footer>
  );
}
