import { Accessibility, Armchair, Crown, Gamepad2, HandHeart, Leaf, PawPrint, PiggyBank, ShieldPlus, Users } from "lucide-react";
import EvCarIcon from "@/components/ev/EvCarIcon";

const FACILITIES: { title: string; note?: string; icon: React.ElementType }[] = [
  { title: "Pet Friendly", note: "Your four-legged teammates are welcome to cheer, play and relax.", icon: PawPrint },
  { title: "AC EV Charging", note: "Paid AC EV charging at the venue. Rs. 50 per hour.", icon: EvCarIcon },
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
      <ul className="mt-3 grid grid-cols-2 gap-2.5 desk:mt-5 desk:grid-cols-4 desk:gap-4">
        {FACILITIES.map(({ title, note, icon: Icon }) => (
          <li
            key={title}
            className="last:col-span-2 desk:last:col-span-1 flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-3 text-center shadow-[0_2px_8px_rgba(15,23,42,0.05)] desk:px-4 desk:py-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-[#0c0b5d] desk:h-12 desk:w-12">
              <Icon size={22} strokeWidth={1.9} aria-hidden />
            </span>
            <span className="mt-0.5 text-[13px] font-bold leading-tight text-[#0c0b5d] desk:text-[15px]">{title}</span>
            {note && <span className="text-[10.5px] leading-snug text-slate-500 desk:text-xs">{note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
