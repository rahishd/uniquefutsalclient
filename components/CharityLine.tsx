import { HandHeart } from "lucide-react";
import { CHARITY_PERCENT, charityOf, charityText } from "@/lib/charity";

// "3% Charity Fund: Rs. 40.50" for the amount being paid. As a row inside a <dl> summary, or as a small note.
export default function CharityLine({ amount, as = "row", align = "center" }: { amount: number; as?: "row" | "note"; align?: "left" | "center" }) {
  if (charityOf(amount) <= 0) return null;
  if (as === "note") {
    return (
      <p className={`flex items-center gap-1.5 text-xs font-medium text-sky-700 ${align === "left" ? "justify-start" : "justify-center"}`}>
        <HandHeart size={14} aria-hidden /> {CHARITY_PERCENT}% Charity Fund: {charityText(amount)}
      </p>
    );
  }
  return (
    <div className="flex justify-between gap-4 text-sky-700">
      <dt className="flex items-center gap-1.5"><HandHeart size={14} aria-hidden /> {CHARITY_PERCENT}% Charity Fund</dt>
      <dd className="font-medium">{charityText(amount)}</dd>
    </div>
  );
}
