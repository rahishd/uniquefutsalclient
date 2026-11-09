"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { mediaUrl, useContent } from "@/lib/content";
import PhotoViewer from "@/components/ads/PhotoViewer";

// The venue's photos (for example from a tournament), just under Quick Access on Home. It only shows once the venue has uploaded photos.
// A slide-along strip of the first photos; a tap opens one full screen (with Download), and "View more" opens the whole Gallery page.
const STRIP = 8;

export default function GallerySection() {
  const photos = useContent().gallery;
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const shown = photos.slice(0, STRIP);

  return (
    <section className="mt-5 desk:mt-0" aria-label="Gallery">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-medium">Gallery</h2>
        <Link href="/gallery" className="inline-flex items-center gap-0.5 text-sm font-medium text-[#3345b0]">View more <ChevronRight size={16} aria-hidden /></Link>
      </div>
      <div className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden tab:mx-0 tab:px-0">
        {shown.map((p, i) => (
          <button type="button" key={p.id} onClick={() => setOpen(i)} aria-label={`Open photo: ${p.title}`} className="relative aspect-[4/3] w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-100 tab:w-60">
            {/* photos come from the venue's own API, so next/image is not used */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(p.imageUrl)} alt={p.title} loading="lazy" draggable={false} className="h-full w-full object-contain" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 pt-6 text-left text-xs font-medium text-white">{p.title}</span>
          </button>
        ))}
        <Link href="/gallery" className="flex aspect-[4/3] w-[40%] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl bg-[#eaf1ff] text-sm font-semibold text-[#2c3da0] tab:w-40">
          View more
          <span className="text-xs font-normal">{photos.length > STRIP ? `${photos.length - STRIP} more photo${photos.length - STRIP === 1 ? "" : "s"}` : "Open the gallery"}</span>
        </Link>
      </div>
      {open !== null && <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}
