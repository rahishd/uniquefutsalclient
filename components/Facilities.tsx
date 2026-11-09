import { Accessibility, Armchair, Crown, Gamepad2, HandHeart, Leaf, PawPrint, PiggyBank, ShieldPlus } from "lucide-react";
import EvCarIcon from "@/components/ev/EvCarIcon";

export const FACILITIES: { title: string; icon: React.ElementType }[] = [
  { title: "Pet Friendly", icon: PawPrint },
  { title: "AC EV Charging", icon: EvCarIcon },
  { title: "3% Charity", icon: HandHeart },
  { title: "Health Insurance", icon: ShieldPlus },
  { title: "FIFA Grade Turf", icon: Leaf },
  { title: "Dedicated Membership Plan", icon: Crown },
  { title: "Wheelchair Access", icon: Accessibility },
  { title: "Gamezone", icon: Gamepad2 },
  { title: "250+ Sitting Space", icon: Armchair },
  { title: "Budget Friendly", icon: PiggyBank },
];

// "What Makes Us Unique": what the venue offers and stands for, each with its own icon. Sits between Corporate Network and the founder message.
export default function Facilities({ className = "mb-10" }: { className?: string }) {
  return (
    <section aria-label="What Makes Us Unique" className={className}>
      <h2 className="text-left text-lg font-bold text-brand desk:text-2xl">What Makes Us Unique</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 desk:mt-5 desk:grid-cols-4 desk:gap-3">
        {FACILITIES.map(({ title, icon: Icon }) => (
          <li
            key={title}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.05)] desk:gap-3 desk:px-4 desk:py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-[#0c0b5d] desk:h-10 desk:w-10">
              <Icon size={18} strokeWidth={1.9} aria-hidden />
            </span>
            <span className="min-w-0 text-[12.5px] font-bold leading-tight text-[#0c0b5d] desk:text-[14px]">{title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
