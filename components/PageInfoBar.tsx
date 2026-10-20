"use client";

import { CalendarDays } from "lucide-react";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";
import { useNepaliToday, useWeather } from "@/lib/today";
import { WeatherIcon } from "@/components/HeaderInfo";
import NotificationBell from "@/components/NotificationBell";
import HeaderPoints from "@/components/HeaderPoints";

// Phone, every page except Home: a slim bar pinned at the top with a greeting, today's Nepali date, the temperature,
// and the bell. (Home has the full company header, the greeting and the date card instead.)
export default function PageInfoBar() {
  const session = useSession();
  const t = useT();
  const today = useNepaliToday();
  const weather = useWeather();
  const name = session?.registered ? (session.name ?? "").trim().split(/\s+/)[0] || "Player" : "Guest";

  return (
    <div className="glass sticky top-0 z-30 rounded-none border-0 shadow-md short:static desk:hidden" style={{ paddingTop: "max(env(safe-area-inset-top), 2.75rem)" }}>
      <div className="flex items-center gap-2 px-5 py-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">
            {t("Hello")}, {session ? name : ""} <span aria-hidden>👋</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
            <CalendarDays size={13} className="shrink-0 text-brand" aria-hidden />
            <span className="truncate">{today.npDay || " "}</span>
            <span aria-hidden className="text-slate-300">·</span>
            <WeatherIcon code={weather ? weather.code : 3} size={14} />
            <span className="shrink-0">{weather ? `${weather.temp}°C` : "--"}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2"><HeaderPoints /><NotificationBell /></div>
      </div>
    </div>
  );
}
