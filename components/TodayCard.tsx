"use client";

import { CalendarDays, MapPin } from "lucide-react";
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

// Home: the venue weather and date as plain text (no card), and the customer's last played game (when there is one) under them.
export default function TodayCard() {
  const today = useNepaliToday();
  const weather = useWeather();
  const t = useT();
  const code = weather ? weather.code : 2;

  return (
    <section aria-label="Today at the venue" className="uf-keep relative order-1 mt-2.5 rounded-2xl bg-white px-4 py-3 text-[#0c0b5d] shadow-[0_8px_20px_-12px_rgba(59,130,246,0.45)] ring-1 ring-[#bfd7ff] desk:col-span-6 desk:mt-0">
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-0.5 text-[30px] font-bold leading-none tracking-tight">
            {weather ? weather.temp : "--"}<span className="text-base font-semibold text-[#3345b0]">°C</span>
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#3345b0]">{t(weatherWord(code))}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm font-bold"><CalendarDays size={15} className="shrink-0 text-[#3345b0]" /><span className="truncate">{today.en || " "}</span></p>
          <p className="mt-0.5 flex items-center justify-end gap-1.5 text-xs font-semibold text-[#3345b0]"><MapPin size={14} className="shrink-0" /><span className="truncate">{weather?.place ?? PLACE}</span></p>
        </div>
      </div>
    </section>
  );
}
