"use client";

import { CalendarDays, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, MapPin, Snowflake, Sun } from "lucide-react";
import { PLACE, useNepaliToday, useWeather } from "@/lib/today";
import { useT } from "@/lib/i18n";

// Words for the weather codes (Open-Meteo / WMO)
export function weatherWord(code: number) {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Rain";
}

// a small icon for the weather code
function weatherIcon(code: number, size: number) {
  if (code === 0 || code === 1) return <Sun size={size} aria-hidden />;
  if (code === 2) return <CloudSun size={size} aria-hidden />;
  if (code === 3) return <Cloud size={size} aria-hidden />;
  if (code === 45 || code === 48) return <CloudFog size={size} aria-hidden />;
  if (code >= 71 && code <= 77) return <Snowflake size={size} aria-hidden />;
  if (code >= 95) return <CloudLightning size={size} aria-hidden />;
  return <CloudRain size={size} aria-hidden />;
}

// Home: the venue weather and date. On the phone it sits inside the account card (`inCard`, components/HomeTop.tsx); on desktop it is its own card.
export default function TodayCard({ inCard = false, dark = false, compact = false }: { inCard?: boolean; dark?: boolean; compact?: boolean }) {
  const today = useNepaliToday();
  const weather = useWeather();
  const t = useT();
  const code = weather ? weather.code : 2;
  const sub = inCard && dark ? "text-sky-200" : "text-[#3345b0]"; // the lighter blue lines; sky blue on the dark VIP card

  // compact: one small tidy row for the top of the phone page (a guest): the weather on the left, the date and place on the right
  if (compact) {
    return (
      <section aria-label="Today at the venue" className="mt-2.5 flex items-center justify-between gap-3 px-1 text-[#0c0b5d] desk:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf1ff] text-[#3345b0]">{weatherIcon(code, 17)}</span>
          <p className="flex items-baseline gap-0.5 text-[20px] font-bold leading-none tracking-tight">{weather ? weather.temp : "--"}<span className="text-[11px] font-semibold text-[#3345b0]">°C</span></p>
          <span aria-hidden className="h-4 w-px bg-[#d8def0]" />
          <p className="truncate text-[11px] font-semibold text-[#3345b0]">{t(weatherWord(code))}</p>
        </div>
        <div className="min-w-0 text-right leading-tight">
          <p className="flex items-center justify-end gap-1 text-[11.5px] font-bold"><CalendarDays size={12} className="shrink-0 text-[#3345b0]" aria-hidden /><span className="truncate">{today.en || " "}</span></p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] font-semibold text-[#3345b0]"><MapPin size={11} className="shrink-0" aria-hidden /><span className="truncate">{weather?.place ?? PLACE}</span></p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Today at the venue" className={inCard ? `relative mt-3 border-t pt-3 desk:hidden ${dark ? "border-white/20 text-white" : "border-[#e3e6f4] text-[#0c0b5d]"}` : "uf-keep relative order-1 mt-2.5 hidden rounded-2xl bg-white px-4 py-3 text-[#0c0b5d] shadow-[0_8px_20px_-12px_rgba(59,130,246,0.45)] ring-1 ring-[#bfd7ff] desk:col-span-4 desk:col-start-1 desk:mt-0 desk:flex desk:items-center"}>
      <div className="relative flex w-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-0.5 text-[30px] font-bold leading-none tracking-tight">
            {weather ? weather.temp : "--"}<span className={`text-base font-semibold ${sub}`}>°C</span>
          </p>
          <p className={`mt-0.5 text-xs font-semibold ${sub}`}>{t(weatherWord(code))}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm font-bold"><CalendarDays size={15} className={`shrink-0 ${sub}`} /><span className="truncate">{today.en || " "}</span></p>
          <p className={`mt-0.5 flex items-center justify-end gap-1.5 text-xs font-semibold ${sub}`}><MapPin size={14} className="shrink-0" /><span className="truncate">{weather?.place ?? PLACE}</span></p>
        </div>
      </div>
    </section>
  );
}
