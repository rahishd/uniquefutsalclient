// What the venue can learn about a website visitor from the request itself: the IP address, roughly where it is, and the device.
// Used by POST /content/visit (the admin Overview > Website visits card shows it). Nothing here needs the visitor to type anything.
import type { Request } from "express";

export type DeviceInfo = { deviceType: string; deviceName: string | null; os: string | null; browser: string | null };
export type Place = { city: string | null; region: string | null; country: string | null };

const clean = (s: unknown, max = 80) => { const v = String(s ?? "").trim().slice(0, max); return v || null; };

/** The visitor's IP (behind the host's proxy the first forwarded address). */
export function clientIp(req: Request): string | null {
  const cf = clean(req.headers["cf-connecting-ip"], 64);
  const ip = cf ?? clean(req.ip, 64);
  return ip ? ip.replace(/^::ffff:/, "") : null;
}

const isPrivate = (ip: string) => ip === "::1" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip);

/** Device type, name (a phone model when the browser tells it), system and browser, read from the User-Agent text. */
export function parseDevice(ua: string | undefined): DeviceInfo {
  const s = ua ?? "";
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(s);
  const mobile = /Mobi|iPhone|iPod|Android.*Mobile/i.test(s);
  let deviceName: string | null = null;
  let os: string | null = null;
  const android = s.match(/Android\s([\d.]+);\s*([^;)]+?)(?:\sBuild|[;)])/i);
  if (android) { os = `Android ${android[1]}`; const m = android[2].trim(); deviceName = /^(K|Linux|Android)$/i.test(m) ? null : m; }
  else if (/iPhone/i.test(s)) { deviceName = "iPhone"; os = `iOS ${(s.match(/OS ([\d_]+)/)?.[1] ?? "").replace(/_/g, ".")}`.trim(); }
  else if (/iPad/i.test(s)) { deviceName = "iPad"; os = `iPadOS ${(s.match(/OS ([\d_]+)/)?.[1] ?? "").replace(/_/g, ".")}`.trim(); }
  else if (/Windows NT/i.test(s)) { deviceName = "Windows PC"; os = `Windows ${/Windows NT 10/i.test(s) ? "10/11" : (s.match(/Windows NT ([\d.]+)/)?.[1] ?? "")}`.trim(); }
  else if (/Mac OS X/i.test(s)) { deviceName = "Mac"; os = "macOS"; }
  else if (/CrOS/i.test(s)) { deviceName = "Chromebook"; os = "ChromeOS"; }
  else if (/Linux/i.test(s)) { deviceName = "Linux PC"; os = "Linux"; }
  const browser =
    /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /SamsungBrowser/.test(s) ? "Samsung Internet" : /Firefox\/|FxiOS/.test(s) ? "Firefox"
      : /Chrome\/|CriOS/.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : null;
  return { deviceType: tablet ? "tablet" : mobile ? "mobile" : "desktop", deviceName, os: clean(os, 40), browser };
}

const cache = new Map<string, Place>();

/**
 * Roughly where an IP is. The host's own headers are used when present (Cloudflare); otherwise one lookup to a public IP-location
 * service, kept in memory per IP. Set VISIT_GEO_LOOKUP=off to never call it. A private/local address has no place.
 */
export async function placeOf(req: Request, ip: string | null): Promise<Place> {
  const none: Place = { city: null, region: null, country: null };
  const cfCountry = clean(req.headers["cf-ipcountry"], 4);
  const cfCity = clean(decodeURIComponent(String(req.headers["cf-ipcity"] ?? "")), 80);
  if (cfCountry || cfCity) return { city: cfCity, region: clean(req.headers["cf-region"], 80), country: cfCountry };
  if (!ip || isPrivate(ip) || process.env.VISIT_GEO_LOOKUP === "off") return none;
  const hit = cache.get(ip);
  if (hit) return hit;
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country`, { signal: AbortSignal.timeout(2500) });
    const j = (await r.json()) as { success?: boolean; city?: string; region?: string; country?: string };
    if (!j.success) return none;
    const place = { city: clean(j.city), region: clean(j.region), country: clean(j.country) };
    if (cache.size > 2000) cache.clear();
    cache.set(ip, place);
    return place;
  } catch {
    return none;
  }
}
