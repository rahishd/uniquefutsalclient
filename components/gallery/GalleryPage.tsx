"use client";

import { useState } from "react";
import Link from "next/link";
import { Images } from "lucide-react";
import { mediaUrl, useContent, type GalleryPhoto } from "@/lib/content";
import PhotoViewer from "@/components/ads/PhotoViewer";

// Every photo the venue has uploaded. Tap one to see it full screen and download it.
const SHAPE: Record<GalleryPhoto["orientation"], string> = { landscape: "aspect-[4/3]", portrait: "aspect-[3/4]", square: "aspect-square" };

export default function GalleryPage() {
  const photos = useContent().gallery;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#2c3da0]"><Images size={20} aria-hidden /></span>
        <div>
          <h1 className="text-xl font-bold text-[#0c0b5d]">Gallery</h1>
          <p className="text-xs text-slate-500">{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}. Tap one to view and download it.` : "No photos yet."}</p>
        </div>
      </header>

      {photos.length === 0 ? (
        <p className="rounded-2xl bg-[#f3f7ff] px-4 py-10 text-center text-sm text-slate-500">Photos from our games and tournaments will appear here.</p>
      ) : (
        <div className="columns-2 gap-3 desk:columns-3">
          {photos.map((p, i) => (
            <button type="button" key={p.id} onClick={() => setOpen(i)} aria-label={`Open photo: ${p.title}`} className={`mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-slate-100 ${SHAPE[p.orientation]}`}>
              {/* photos come from the venue's own API, so next/image is not used */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p.imageUrl)} alt={p.title} loading="lazy" draggable={false} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Link href="/" className="block rounded-full bg-[#dbeafe] py-3 text-center text-sm font-semibold text-[#2c3da0]">Back to Home</Link>
      {open !== null && <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
