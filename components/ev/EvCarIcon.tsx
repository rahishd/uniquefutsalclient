import { CarFront, Zap } from "lucide-react";

// A car with a lightning bolt striking it: the EV charging icon, used on the Facilities card and the Quick Access tile.
export default function EvCarIcon({ size = 28, strokeWidth = 1.9, className, ...rest }: { size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }) {
  return (
    <span className={`relative inline-flex ${className ?? ""}`} style={{ width: size, height: size }} {...rest}>
      <CarFront size={size} strokeWidth={strokeWidth} />
      <Zap size={size * 0.5} strokeWidth={2.2} className="absolute -right-1 -top-1 fill-amber-400 text-amber-500 drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]" />
    </span>
  );
}
