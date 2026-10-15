"use client";

import { Mail, MapPin, PhoneCall } from "lucide-react";
import { FaFacebookF, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";
import PartnersStrip from "@/components/PartnersStrip";


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
  const t = useT();
  return (
    <footer className="mx-auto w-full max-w-md px-5 pb-28 pt-6 desk:max-w-none desk:px-10 desk:pb-14 desk:pt-6">
      {/* the organisations the venue works with: between the promo codes above and the founder message */}
      <PartnersStrip />

      <section aria-label="A message from the founder" className="glass mb-10 overflow-hidden rounded-3xl">
        <div className="relative bg-slate-100 text-slate-700">
          {/* big quotation marks, as in the template */}
          <span aria-hidden className="pointer-events-none absolute left-3 top-0 select-none font-serif text-[8rem] leading-none text-slate-300 desk:left-8 desk:text-[13rem]">“</span>
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 select-none font-serif text-[8rem] leading-[0.6] text-slate-300 desk:bottom-6 desk:left-auto desk:right-[38%] desk:text-[13rem]">”</span>

          <div className="relative grid desk:grid-cols-[1.55fr_1fr]">
            <div className="space-y-3 px-6 pb-6 pt-16 text-sm leading-relaxed desk:px-12 desk:pb-12 desk:pt-24 desk:text-[17px] desk:leading-8">
              <h2 className="text-xl font-bold text-slate-900 desk:text-3xl">A Message from the Founder</h2>
              <p className="font-semibold text-slate-900">Greetings to all our valued customers and players,</p>
              <p>
                I am Rahish Dumre, Founder of Unique Futsal. My vision for Unique Futsal began in 2017 with a simple idea: to create an indoor futsal facility that stands apart from others—not only through its facilities but also through the experience and relationships it builds, Since their name &quot;Unique&quot; was born. Established in 2018, Unique Futsal was founded on the principles of comfort, refreshment, and a welcoming, family-like environment.
              </p>
              <p>
                Our journey has always been about providing more than just a place to play. In 2019, we introduced health insurance to support players against unexpected injuries. In 2021, we launched dedicated membership plans for men, women, and corporate groups. In 2023, we established our Children&apos;s Academy for ages 10–15, focusing on skill development, physical fitness, and discipline. In 2024, we introduced GameZone to extend the experience beyond the court and encourage social connections through digital entertainment.
              </p>
              <p>Looking ahead, my vision is to develop a technology-driven futsal experience with seamless online booking and integrated services.</p>
              <p>Interestingly, this system is self-built by me. Briefly about my background: I hold a BSc (Hons) in Computing and an MSc (Hons) in Cyber Security Threat Intelligence from London Metropolitan University.</p>
              <p>I believe futsal is more than a sport; it builds teamwork, promotes a healthy lifestyle, develops discipline, and strengthens communities.</p>
              <p>Thank you for your continued trust and support. Unique Futsal is not just a venue; it is a community we build together.</p>
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
    </footer>
  );
}
