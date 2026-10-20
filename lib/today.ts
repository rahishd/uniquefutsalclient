"use client";

// Today's Nepali (B.S.) date and the temperature at the venue, shared by the Home date card (components/HeaderInfo.tsx)
// and the info bar on every other page (components/PageInfoBar.tsx). The weather is fetched once and kept for 30 minutes,
// so moving between pages does not ask for it again.

import { useEffect, useState, useSyncExternalStore } from "react";
import NepaliDate from "nepali-date-converter";

// The temperature is for where the customer is: the phone's location when they allow it, otherwise a rough location from their
// internet address, and the venue's town (below, Kathmandu unless set) only when neither works.
const LAT = process.env.NEXT_PUBLIC_VENUE_LAT || "27.7172";
const LON = process.env.NEXT_PUBLIC_VENUE_LON || "85.324";
export const PLACE = process.env.NEXT_PUBLIC_VENUE_NAME || "Kathmandu";
const KEEP_MS = 30 * 60 * 1000;

export type Weather = { temp: number; code: number; place: string };

interface Spot { lat: number; lon: number; place: string }
const SPOT_KEY = "uf-weather-spot-v1";
const SPOT_KEEP_MS = 6 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100; // about 1 km: enough for the weather, and less of the customer's position leaves the phone

function storedSpot(): Spot | null {
  try {
    const v = JSON.parse(localStorage.getItem(SPOT_KEY) ?? "null");
    return v && Date.now() - v.at < SPOT_KEEP_MS ? v : null;
  } catch {
    return null;
  }
}

async function placeName(lat: number, lon: number): Promise<string | null> {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (!r.ok) return null;
    const j = await r.json();
    return j.locality || j.city || j.principalSubdivision || null;
  } catch {
    return null;
  }
}

function phonePosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: round2(p.coords.latitude), lon: round2(p.coords.longitude) }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function locate(): Promise<Spot> {
  const saved = storedSpot();
  if (saved) return saved;

  let spot: Spot | null = null;
  const denied = await navigator.permissions?.query({ name: "geolocation" }).then((s) => s.state === "denied").catch(() => false);
  const here = denied ? null : await phonePosition();
  if (here) {
    spot = { ...here, place: (await placeName(here.lat, here.lon)) ?? "Your area" };
  } else {
    try {
      const r = await fetch("https://get.geojs.io/v1/ip/geo.json");
      const j = r.ok ? await r.json() : null;
      if (j?.latitude && j?.longitude) spot = { lat: round2(Number(j.latitude)), lon: round2(Number(j.longitude)), place: j.city || j.region || "Your area" };
    } catch {
      // no rough location either: the venue's town is used
    }
  }
  if (!spot) return { lat: Number(LAT), lon: Number(LON), place: PLACE }; // not remembered, so the next visit tries again
  try { localStorage.setItem(SPOT_KEY, JSON.stringify({ ...spot, at: Date.now() })); } catch { /* storage blocked */ }
  return spot;
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
const noopSubscribe = () => () => {};

/** Today in B.S.: { np: "30 आश्विन 2083, शुक्र", npShort: "30 आश्विन, शुक्र", npDay: "30 आश्विन", en: "30 Aswin 2083" } (empty on the server). */
export function useNepaliToday() {
  const key = useSyncExternalStore(noopSubscribe, dayKey, () => "");
  if (!key) return { np: "", npShort: "", npDay: "", en: "" };
  const [y, m, d] = key.split("-").map(Number);
  const bs = new NepaliDate(new Date(y, m, d));
  return { np: bs.format("DD MMMM YYYY, ddd", "np"), npShort: bs.format("DD MMMM, ddd", "np"), npDay: bs.format("DD MMMM", "np"), en: bs.format("DD MMMM YYYY") };
}

let cached: { at: number; w: Weather } | null = null;
let inflight: Promise<Weather | null> | null = null;

function loadWeather(): Promise<Weather | null> {
  if (cached && Date.now() - cached.at < KEEP_MS) return Promise.resolve(cached.w);
  if (!inflight) {
    inflight = locate()
      .then((spot) =>
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}&current=temperature_2m,weather_code&timezone=auto`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((j) => ({ j, spot })),
      )
      .then(({ j, spot }) => {
        const w = { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, place: spot.place };
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
