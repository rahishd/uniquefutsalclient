"use client";

// Today's Nepali (B.S.) date and the temperature at the venue, shared by the Home date card (components/HeaderInfo.tsx)
// and the info bar on every other page (components/PageInfoBar.tsx). The weather is fetched once and kept for 30 minutes,
// so moving between pages does not ask for it again.

import { useEffect, useState, useSyncExternalStore } from "react";
import NepaliDate from "nepali-date-converter";

// Venue location for the temperature. Defaults to Kathmandu.
const LAT = process.env.NEXT_PUBLIC_VENUE_LAT || "27.7172";
const LON = process.env.NEXT_PUBLIC_VENUE_LON || "85.324";
export const PLACE = process.env.NEXT_PUBLIC_VENUE_NAME || "Kathmandu";
const KEEP_MS = 30 * 60 * 1000;

export type Weather = { temp: number; code: number };

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
const noopSubscribe = () => () => {};

/** Today in B.S.: { np: "30 आश्विन 2083, शुक्र", npShort: "30 आश्विन, शुक्र", en: "30 Aswin 2083" } (empty on the server). */
export function useNepaliToday() {
  const key = useSyncExternalStore(noopSubscribe, dayKey, () => "");
  if (!key) return { np: "", npShort: "", en: "" };
  const [y, m, d] = key.split("-").map(Number);
  const bs = new NepaliDate(new Date(y, m, d));
  return { np: bs.format("DD MMMM YYYY, ddd", "np"), npShort: bs.format("DD MMMM, ddd", "np"), en: bs.format("DD MMMM YYYY") };
}

let cached: { at: number; w: Weather } | null = null;
let inflight: Promise<Weather | null> | null = null;

function loadWeather(): Promise<Weather | null> {
  if (cached && Date.now() - cached.at < KEEP_MS) return Promise.resolve(cached.w);
  if (!inflight) {
    inflight = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=auto`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const w = { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code };
        cached = { at: Date.now(), w };
        return w;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** The temperature at the venue, or null until it arrives (or if it cannot be fetched). */
export function useWeather() {
  const [w, setW] = useState<Weather | null>(cached?.w ?? null);
  useEffect(() => {
    let live = true;
    loadWeather().then((x) => { if (live && x) setW(x); });
    return () => { live = false; };
  }, []);
  return w;
}
