import { Accessibility, Armchair, Crown, Gamepad2, HandHeart, Leaf, PiggyBank, ShieldPlus, Users, type LucideIcon } from "lucide-react";

const FACILITIES: { title: string; note?: string; icon: LucideIcon }[] = [
  { title: "5A Side", note: "Spacious 5A side futsal in town.", icon: Users },
  { title: "3% Charity", note: "You are not just playing, you are educating poor children beyond the field.", icon: HandHeart },
  { title: "Health Insurance", note: "We've got you covered, but play with safety.", icon: ShieldPlus },
  { title: "FIFA Grade Turf", note: "We offer what you pay for, and give you the best quality FIFA grade turf for your best experience.", icon: Leaf },
  { title: "Dedicated Membership Plan", icon: Crown },
  { title: "Wheelchair Access", note: "We have dedicated space for physically impaired persons.", icon: Accessibility },
  { title: "Gamezone", note: "Digital entertainment beyond the field.", icon: Gamepad2 },
  { title: "250+ Sitting Space", note: "Sky Deck and Elite Deck", icon: Armchair },
  { title: "Budget Friendly", note: "We give more than you pay.", icon: PiggyBank },
];

// "What Makes Us Unique": what the venue offers and stands for, each with its own icon. Sits between Corporate Network and the founder message.
export default function Facilities() {
  return (
    <section aria-label="What Makes Us Unique" className="mb-10">
      <h2 className="text-left text-lg font-bold text-brand desk:text-2xl">What Makes Us Unique</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 desk:mt-6 desk:grid-cols-3 desk:gap-5">
        {FACILITIES.map(({ title, note, icon: Icon }) => (
          <li
            key={title}
            className="last:col-span-2 desk:last:col-span-1 flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-3 py-5 text-center shadow-[0_2px_10px_rgba(15,23,42,0.05)] desk:py-7"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-[#0c0b5d] desk:h-16 desk:w-16">
              <Icon size={28} strokeWidth={1.9} aria-hidden />
            </span>
            <span className="text-sm font-semibold leading-snug text-slate-800 desk:text-base">{title}</span>
            {note && <span className="-mt-2 text-[11px] leading-snug text-slate-500 desk:text-xs">{note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
