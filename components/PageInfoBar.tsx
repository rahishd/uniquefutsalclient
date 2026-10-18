"use client";

import Link from "next/link";
import { CalendarDays, Star } from "lucide-react";
import { loyaltyStore } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";
import { useNepaliToday, useWeather } from "@/lib/today";
import { WeatherIcon } from "@/components/HeaderInfo";
import NotificationBell from "@/components/NotificationBell";
import HeaderPoints from "@/components/HeaderPoints";

// Phone, every page except Home: a slim bar pinned at the top with a greeting, today's Nepali date, the temperature,
// the loyalty points the customer can spend, and the bell. (Home has the full company header, the greeting and the date card instead.)
export default function PageInfoBar() {
  const session = useSession();
  const t = useT();
  const today = useNepaliToday();
  const weather = useWeather();
  const registered = session?.registered === true;
  const points = loyaltyStore.use().data?.remaining ?? null;
  const name = session?.registered ? (session.name ?? "").trim().split(/\s+/)[0] || "Player" : "Guest";

  return (
    <div className="sticky top-0 z-30 px-3 pb-1 short:static desk:hidden" style={{ paddingTop: "calc(env(safe-area-inset-top) + 40px)" }}>
      <div className="glass flex items-center gap-2 rounded-2xl py-2 pl-3.5 pr-2 shadow-md">
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
        {/* points the customer can spend now; a tap opens the Points page (guests have none, so it is hidden) */}
        {registered && (
          <Link href="/points" aria-label={points === null ? "Loyalty points" : `${fmtPts(points)} loyalty points available`} className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-amber-400/30">
            <Star size={14} className="fill-amber-400 text-amber-500" aria-hidden />
            <span>{points === null ? "--" : fmtPts(points)}</span>
            <span className="text-[11px] font-medium">{t("pts")}</span>
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-2"><HeaderPoints /><NotificationBell /></div>
      </div>
    </div>
  );
}
