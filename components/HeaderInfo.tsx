"use client";

import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, CalendarDays } from "lucide-react";
import { PLACE, useNepaliToday, useWeather } from "@/lib/today";

export function WeatherIcon({ code, size = 22 }: { code: number; size?: number }) {
  const cls = "text-amber-500";
  if (code === 0 || code === 1) return <Sun size={size} className={cls} />;
  if (code === 2 || code === 3) return <Cloud size={size} className={cls} />;
  if (code === 45 || code === 48) return <CloudFog size={size} className={cls} />;
  if (code >= 71 && code <= 77) return <CloudSnow size={size} className={cls} />;
  if (code >= 95) return <CloudLightning size={size} className={cls} />;
  return <CloudRain size={size} className={cls} />;
}

// Home: today's Nepali date and the temperature at the venue.
export default function HeaderInfo() {
  const today = useNepaliToday();
  const weather = useWeather();

  return (
    <div className="glass mt-5 flex items-center justify-between rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        <CalendarDays size={20} className="text-brand" />
        <div className="leading-tight">
          <p className="text-sm font-medium">{today.np || " "}</p>
          <p className="text-[11px] text-slate-400">{today.en || " "} B.S.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border-l border-slate-200/80 pl-4">
        <WeatherIcon code={weather ? weather.code : 3} />
        <div className="leading-tight text-right">
          <p className="text-sm font-medium">{weather ? `${weather.temp}°C` : "--"}</p>
          <p className="text-[11px] text-slate-400">{PLACE}</p>
        </div>
      </div>
    </div>
  );
}
