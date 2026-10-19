"use client";

import { ScrollText } from "lucide-react";

// Rules & Regulations of the venue. The text will be filled in later and managed from the admin portal (a dynamic page), so this
// page only holds the layout and an empty state for now.
export default function RulesPage() {
  return (
    <div className="space-y-4 pb-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold desk:text-3xl"><ScrollText className="text-brand" size={26} /> Rules &amp; Regulations</h1>
      <section className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center" aria-label="Rules and Regulations">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><ScrollText size={28} /></span>
        <p className="font-semibold">Coming soon</p>
        <p className="max-w-xs text-sm text-slate-500">The venue rules and regulations will be published here. Please check back soon.</p>
      </section>
    </div>
  );
}
