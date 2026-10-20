"use client";

import { CalendarDays, MapPin } from "lucide-react";
import LastPlayed from "@/components/LastPlayed";
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

// Home: one light-blue card. The venue weather and date sit on top, and the customer's last played game (when there is one) is inside the same card, underneath.
export default function TodayCard() {
  const today = useNepaliToday();
  const weather = useWeather();
  const t = useT();
  const code = weather ? weather.code : 2;

  return (
    <section aria-label="Today at the venue" className="uf-keep relative order-1 mt-3 overflow-hidden rounded-3xl border border-white/10 p-3.5 shadow-[0_10px_26px_-8px_rgba(5,10,43,0.7)] desk:mt-4 desk:p-4"
      style={{ background: "linear-gradient(135deg, #0c0b5d 0%, #08084a 55%, #050a2b 100%)", color: "#ffffff" }}>
      {/* soft glow in the corner */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#3b4bd8] opacity-40 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-0.5 text-[34px] font-semibold leading-none">
            {weather ? weather.temp : "--"}<span className="text-base font-medium">°C</span>
          </p>
          <p className="mt-1 text-xs font-medium text-sky-200">{t(weatherWord(code))}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm font-semibold"><CalendarDays size={14} className="shrink-0" /><span className="truncate">{today.en || " "}</span></p>
          <p className="mt-1 flex items-center justify-end gap-1.5 text-xs font-medium text-sky-200"><MapPin size={13} className="shrink-0" /><span className="truncate">{PLACE}</span></p>
        </div>
      </div>
      <LastPlayed embedded />
    </section>
  );
}
