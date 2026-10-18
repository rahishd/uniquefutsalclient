"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, MapPin, PhoneCall, Leaf, Smartphone } from "lucide-react";
import { FaFacebookF, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";
import PartnersStrip from "@/components/PartnersStrip";
import Facilities from "@/components/Facilities";


function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  const cls = "glass flex h-12 w-12 items-center justify-center rounded-2xl text-lg";
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
        {/* the same ISO certification box, under the founder's name card */}
      </section>

      {/* the ISO certification card: its own card, so it reads as separate from the founder card */}
        <div className="mb-10 mt-4 rounded-2xl bg-[#0c0b5d] p-4 text-white shadow-[0_14px_30px_-16px_rgba(12,11,93,0.8)]">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/iso-certification.png" alt="ISO certification" className="h-14 w-auto shrink-0 rounded-md bg-white p-1" />
          <p className="text-sm font-semibold leading-snug">Nepal&apos;s First ISO Certified Futsal</p>
        </div>
        <div className="mt-3 border-t border-white/25 pt-3">
          <p className="text-sm font-bold">ISO 9001:2015 Certification</p>
          <p className="mt-1 text-xs leading-relaxed text-white/90">Since 2026, Unique Futsal has upheld quality-driven operations, earning ISO 9001:2015 certification for its commitment to efficient management, consistent service standards, customer satisfaction, safety, and continuous improvement.</p>
        </div>
      </div>

      <div className="space-y-10 desk:grid desk:grid-cols-3 desk:gap-10 desk:space-y-0">
        <div>
          <h2 className={heading}>{t("Contact us")}</h2>
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
        </div>

        <div>
          <h2 className={heading}>{t("Follow us")}</h2>
          <p className="mt-4 text-sm text-slate-500">{t("Stay updated with our latest offers, tournaments, and events.")}</p>
          <div className="mt-4 flex gap-3">
            <Social href={site.whatsapp} label="WhatsApp">
              <FaWhatsapp className="text-[#25d366]" />
            </Social>
            <Social href={site.facebook} label="Facebook">
              <FaFacebookF className="text-[#1877f2]" />
            </Social>
            <Social href={site.tiktok} label="TikTok">
              <FaTiktok className="text-black" />
            </Social>
          </div>
        </div>

        <div>
          <h2 className={heading}>{t("Find us")}</h2>
          <div className="glass mt-4 overflow-hidden rounded-2xl">
            <iframe
              title={`${site.name} on Google Maps`}
              src={site.mapEmbed}
              className="h-48 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      {/* Go Digital Go Paperless section */}
      <section aria-label="Environmental commitment" className="mb-8 mt-16 rounded-3xl bg-white p-4 shadow-md ring-1 ring-slate-200">
        <div className="space-y-4">
          <div className="grid grid-cols-2 items-center gap-4">
            <div className="flex items-center justify-start gap-3">
              <Smartphone size={18} className="text-[#0c0b5d]" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#0c0b5d]">Go Digital</h3>
                <p className="text-[11px] text-[#0c0b5d] font-semibold">Go Paperless</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Leaf size={18} className="text-[#0c0b5d]" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#0c0b5d]">Save</h3>
                <p className="text-[11px] text-[#0c0b5d] font-semibold">Environment</p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <p className="text-center text-[11px] leading-relaxed text-[#0c0b5d]">At Unique Futsal, we believe in making everyday operations smarter and easier through digital technology. From bookings and payments to records and daily management, we handle almost everything digitally, reducing the need for paper and printed documents while creating a more efficient, eco-friendly, and sustainable environment.</p>
          </div>
        </div>
      </section>

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
