"use client";

import { CalendarDays, MapPin } from "lucide-react";
import HomeSearch from "@/components/HomeSearch";
import { PLACE, useNepaliToday, useWeather } from "@/lib/today";
import { useT } from "@/lib/i18n";

// Words for the weather codes (Open-Meteo / WMO)
function weatherWord(code: number) {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Rain";
}

// A soft 3D-looking weather picture: sun, cloud, rain or a storm. Kept in its real colours in dark mode (uf-kid).
function WeatherArt({ code }: { code: number }) {
  const sun = code <= 2;
  const rain = code >= 51 && code < 95;
  const storm = code >= 95;
  return (
    <svg viewBox="0 0 120 90" className="uf-kid h-20 w-28 drop-shadow-[0_10px_14px_rgba(59,130,246,0.25)]" aria-hidden>
      <defs>
        <radialGradient id="hh-sun" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fff7c2" /><stop offset="0.55" stopColor="#fcd34d" /><stop offset="1" stopColor="#f59e0b" /></radialGradient>
        <linearGradient id="hh-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dbeafe" /></linearGradient>
      </defs>
      {sun && (
        <g>
          <circle cx="78" cy="30" r="20" fill="url(#hh-sun)">
            <animate attributeName="r" values="20;21.5;20" dur="4s" repeatCount="indefinite" />
          </circle>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="76.5" y="2" width="3" height="7" rx="1.5" fill="#fbbf24" transform={`rotate(${a} 78 30)`} opacity="0.85" />)}
        </g>
      )}
      <g>
        <path d="M24 70 a16 16 0 0 1 4 -31 a22 22 0 0 1 41 -6 a17 17 0 0 1 21 16 a14 14 0 0 1 -3 28 z" fill="url(#hh-cloud)" stroke="#bfdbfe" strokeWidth="1.5" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 3 0; 0 0" dur="6s" repeatCount="indefinite" />
      </g>
      {rain && [34, 50, 66].map((x, i) => (
        <path key={x} d={`M${x} 80 l-3 8`} stroke="#60a5fa" strokeWidth="3" strokeLinecap="round">
          <animate attributeName="opacity" values="0;1;0" dur="1.2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
        </path>
      ))}
      {storm && <path d="M54 72 l-8 12 h7 l-4 10 l12 -15 h-7 l4 -7 z" fill="#facc15" />}
    </svg>
  );
}

// Home hero (the same light blue as the other highlighted cards, see globals.css): temperature and a weather picture at the venue, today's Nepali date, and the search bar.
export default function HomeHero() {
  const today = useNepaliToday();
  const weather = useWeather();
  const t = useT();
  const code = weather ? weather.code : 2;

  return (
    <section aria-label="Today at the venue" className="relative mt-5 overflow-visible rounded-[28px] border border-[#bfd7ff] p-5 shadow-[0_8px_24px_rgba(59,130,246,0.16)]"
      style={{ background: "linear-gradient(135deg, #eaf3ff 0%, #d6e7ff 55%, #c3dcff 100%)" }}>
      {/* soft light in the corner */}
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white opacity-50 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1 text-[44px] font-semibold leading-none text-[#0c0b5d]">
            {weather ? weather.temp : "--"}<span className="text-2xl font-medium">°C</span>
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#1e3a8a]">{t(weatherWord(code))}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#1e3a8a]/80"><MapPin size={13} /> {PLACE}</p>
        </div>
        <WeatherArt code={code} />
      </div>
      <p className="relative mt-3 flex items-center gap-2 text-xs font-medium text-[#0c0b5d]">
        <CalendarDays size={14} />
        <span>{today.np || " "}</span>
        <span className="text-[#1e3a8a]/70">{today.en ? `· ${today.en} B.S.` : ""}</span>
      </p>

      <div className="relative">
        <HomeSearch />
      </div>
    </section>
  );
}
