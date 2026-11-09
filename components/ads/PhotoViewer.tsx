"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { mediaUrl, type GalleryPhoto } from "@/lib/content";

// Saves a gallery photo on the customer's phone. iPhones get the share sheet (it has "Save Image"); everything else downloads the file.
async function savePhoto(p: GalleryPhoto) {
  const url = mediaUrl(p.imageUrl);
  try {
    const blob = await (await fetch(url)).blob();
    const name = `${p.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "unique-futsal-photo"}.jpg`;
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer"); // the browser could not fetch it: open the picture so it can be saved by hand
  }
}

// A gallery photo full screen: swipe or use the arrows for the next one, and Download saves it.
export default function PhotoViewer({ photos, index, onIndex, onClose }: { photos: GalleryPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const touch = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const current = photos[index];
  if (!current) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/90"
      role="dialog" aria-modal="true" aria-label={current.title}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm text-white/70">{index + 1} / {photos.length}</span>
        {/* the same red round button as Back (components/BottomNav.tsx) */}
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white shadow-[0_8px_20px_-6px_rgba(220,38,38,0.6)] ring-[3px] ring-white transition active:scale-90"><X size={22} strokeWidth={2.6} aria-hidden /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {/* photos come from the venue's own API, so next/image is not used */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(current.imageUrl)} alt={current.title} className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"><ChevronLeft size={24} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"><ChevronRight size={24} /></button>
          </>
        )}
      </div>
      <div className="space-y-3 p-5 text-center text-white" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <div>
          <p className="font-medium">{current.title}</p>
          {current.caption && <p className="mt-1 text-sm text-white/70">{current.caption}</p>}
        </div>
        <button type="button" disabled={saving} onClick={async () => { setSaving(true); await savePhoto(current); setSaving(false); }} className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0b5d] disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download photo
        </button>
      </div>
    </div>
  );
}
