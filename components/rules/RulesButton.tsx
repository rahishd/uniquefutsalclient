import Link from "next/link";
import { ScrollText } from "lucide-react";

// "Rules & Regulations" icon next to "Hello" on Home. Everyone can open it, guests included.
export default function RulesButton() {
  return (
    <Link href="/rules" aria-label="Rules and Regulations" title="Rules & Regulations" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm">
      <ScrollText size={18} />
    </Link>
  );
}
