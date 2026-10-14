import { mediaUrl } from "@/lib/content";

// Round profile picture (the customer's photo, or their initial) with the gold (C) badge when in Captain mode.
export default function ProfileAvatar({ name, captain, size = 56, src }: { name: string; captain: boolean; size?: number; src?: string | null }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(src)} alt={name} draggable={false} className="h-full w-full rounded-full object-cover shadow-md ring-2 ring-white" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#2a2a9c] to-brand font-semibold text-white shadow-md ring-2 ring-white"
          style={{ fontSize: size * 0.34 }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {captain && (
        <span
          role="img"
          aria-label="Captain"
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-amber-400 font-bold text-[#0c0b5d] shadow ring-2 ring-white"
          style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.2 }}
        >
          C
        </span>
      )}
    </span>
  );
}
