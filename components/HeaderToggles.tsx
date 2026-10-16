"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

// Keeps <html lang> in step with the chosen language (screen readers and browsers use it).
export function LangSync() {
  const [lang] = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

const round =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand/40 hover:shadow-md active:scale-95";

// Two round buttons on the right of the header. Each one shows the OTHER option and switches to it when tapped:
// the moon turns dark mode on (and becomes a sun), and "NP" switches to Nepali (and becomes "EN").
export default function HeaderToggles() {
  const [theme, setTheme] = useTheme();
  const [lang, setLang] = useLang();
  const dark = theme === "dark";
  const ne = lang === "ne";
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1.5 desk:ml-0">
      <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} className={round}>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button type="button" onClick={() => setLang(ne ? "en" : "ne")} aria-label={ne ? "Switch to English" : "Switch to Nepali"} title={ne ? "English" : "नेपाली"} className={`${round} text-[11px] font-bold tracking-wide`}>
        {ne ? "EN" : "NP"}
      </button>
    </div>
  );
}
