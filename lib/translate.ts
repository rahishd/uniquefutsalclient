// Nepali translation engine (no React here). The dictionary is large, so it is loaded only when Nepali is chosen.
//
//   translateText(s)  - translate a piece of text: exact match, then templates with {0} values, then dates/times/money
//   translateBlock(s) - exact match or template only (null when nothing matches); used for text split across nodes
//
// Templates come from text built from values, such as "Pay {0} at the venue". Each {n} is filled with what the page
// showed there (and translated itself when it is a known word).

type Template = { re: RegExp; order: number[]; ne: string; probe: string };

const exact = new Map<string, string>();
const templates: Template[] = [];
let ready = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const isDictionaryReady = () => ready;
export const subscribeDictionary = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function build(dict: Record<string, string>) {
  exact.clear();
  templates.length = 0;
  for (const [en, ne] of Object.entries(dict)) {
    const slots = [...en.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
    if (!slots.length) {
      exact.set(en, ne);
      continue;
    }
    const parts = en.split(/\{\d+\}/).map((p) => p.trim());
    const literal = parts.join(" ");
    if ((literal.match(/[A-Za-z]/g) ?? []).length < 3) continue; // a template that is mostly values would match everything
    const source = "^\\s*" + parts.map((p) => escapeRe(p).replace(/\s+/g, "\\s+")).join("\\s*(.*?)\\s*") + "\\s*$";
    const probe = parts.reduce((a, b) => (b.length > a.length ? b : a), "");
    templates.push({ re: new RegExp(source, "s"), order: slots, ne, probe });
  }
  templates.sort((a, b) => b.probe.length - a.probe.length); // the most specific template wins
}

export function loadDictionary(): Promise<void> {
  if (ready) return Promise.resolve();
  if (!loading) {
    loading = import("@/lib/ne-dictionary").then((m) => {
      build(m.NE_DICTIONARY);
      ready = true;
      listeners.forEach((l) => l());
    });
  }
  return loading;
}

// ---- dates, times and money ----
const DAYS: Record<string, string> = {
  Monday: "सोमबार", Tuesday: "मंगलबार", Wednesday: "बुधबार", Thursday: "बिहीबार", Friday: "शुक्रबार", Saturday: "शनिबार", Sunday: "आइतबार",
  Mon: "सोम", Tue: "मंगल", Wed: "बुध", Thu: "बिही", Fri: "शुक्र", Sat: "शनि", Sun: "आइत",
};
const MONTHS: Record<string, string> = {
  January: "जनवरी", February: "फेब्रुअरी", March: "मार्च", April: "अप्रिल", June: "जुन", July: "जुलाई", August: "अगस्ट",
  September: "सेप्टेम्बर", October: "अक्टोबर", November: "नोभेम्बर", December: "डिसेम्बर",
  Jan: "जनवरी", Feb: "फेब्रुअरी", Mar: "मार्च", Apr: "अप्रिल", Jun: "जुन", Jul: "जुलाई", Aug: "अगस्ट",
  Sep: "सेप्टेम्बर", Sept: "सेप्टेम्बर", Oct: "अक्टोबर", Nov: "नोभेम्बर", Dec: "डिसेम्बर",
  // Bikram Sambat months
  Baisakh: "बैशाख", Baishakh: "बैशाख", Jestha: "जेठ", Ashadh: "असार", Asar: "असार", Shrawan: "साउन", Srawan: "साउन",
  Bhadra: "भदौ", Bhadau: "भदौ", Ashwin: "असोज", Aswin: "असोज", Asoj: "असोज", Kartik: "कात्तिक", Mangsir: "मंसिर",
  Poush: "पुष", Push: "पुष", Magh: "माघ", Falgun: "फागुन", Phalgun: "फागुन", Chaitra: "चैत",
};
const WORDS = new RegExp("\\b(" + [...Object.keys(DAYS), ...Object.keys(MONTHS)].sort((a, b) => b.length - a.length).join("|") + ")\\b", "g");

const UNITS: Record<string, string> = {
  day: "दिन", days: "दिन", hour: "घण्टा", hours: "घण्टा", hr: "घण्टा", hrs: "घण्टा", minute: "मिनेट", minutes: "मिनेट",
  min: "मिनेट", mins: "मिनेट", week: "हप्ता", weeks: "हप्ता", month: "महिना", months: "महिना", year: "वर्ष", years: "वर्ष",
};

function tokens(s: string): string {
  let out = s.replace(WORDS, (w) => DAYS[w] ?? MONTHS[w] ?? w);
  out = out.replace(/\b(\d+)\s*(days?|hours?|hrs?|minutes?|mins?|weeks?|months?|years?)\b/gi, (_m, n: string, u: string) => `${n} ${UNITS[u.toLowerCase()] ?? u}`);
  out = out.replace(/\bRs\.?\s*(?=\d)/g, "रू. ");
  out = out.replace(/(\d{1,2})(:\d{2})?\s?(AM|PM)\b/g, (_m, h: string, mm: string | undefined, ap: string) => {
    const hour = Number(h);
    const part = ap === "AM" ? "बिहान" : hour === 12 || hour < 5 ? "दिउँसो" : "बेलुका";
    return `${h}${mm ?? ""} ${part}`;
  });
  return out;
}

const MAX_VALUE = 40; // a value filled into a template is a name, number, date or word, never a whole sentence

function fromTemplate(core: string, depth: number): string | null {
  const hit = exact.get(core);
  if (hit !== undefined) return hit;
  let best: { score: number; t: Template; values: string[] } | null = null;
  for (const t of templates) {
    if (!core.includes(t.probe)) continue;
    const m = t.re.exec(core);
    if (!m) continue;
    const values = m.slice(1);
    if (values.some((v) => v.length > MAX_VALUE)) continue;
    const score = core.length - values.reduce((n, v) => n + v.length, 0); // how much of the text the template itself covers
    if (!best || score > best.score) best = { score, t, values };
  }
  if (!best) return null;
  const { t, values } = best;
  return t.ne.replace(/\{(\d+)\}/g, (_x, i: string) => {
    const at = t.order.indexOf(Number(i));
    const v = (at >= 0 ? values[at] ?? "" : "").trim();
    return v ? translateCore(v, depth + 1) : "";
  });
}

// exact match, template, then the same on the pieces of a longer text (split at " · " and at sentence ends)
function translateCore(core: string, depth = 0): string {
  const hit = fromTemplate(core, depth);
  if (hit !== null) return tokens(hit);
  if (depth < 2) {
    const dots = core.split(" · ");
    if (dots.length > 1) {
      const parts = dots.map((p) => translateCore(p, depth + 1));
      if (parts.some((p, i) => p !== dots[i])) return parts.join(" · ");
    }
    const sentences = core.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/);
    if (sentences.length > 1) {
      const parts = sentences.map((p) => translateCore(p, depth + 1));
      if (parts.some((p, i) => p !== sentences[i])) return parts.join(" ");
    }
  }
  return tokens(core);
}

const hasLetters = (s: string) => /[A-Za-z]/.test(s);

// exact match or template only
export function translateBlock(text: string): string | null {
  if (!ready) return null;
  const core = text.replace(/\s+/g, " ").trim();
  if (!core || !hasLetters(core)) return null;
  const out = fromTemplate(core, 0);
  return out === null ? null : tokens(out);
}

export function translateText(text: string): string {
  if (!ready || !hasLetters(text)) return text;
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  const core = text.replace(/\s+/g, " ").trim();
  if (!core) return text;
  const out = translateCore(core);
  return out === core ? text : lead + out + trail;
}
