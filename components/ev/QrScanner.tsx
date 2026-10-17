"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";

// Full-screen camera that reads one QR code and hands its text back. Nothing is recorded or uploaded; frames stay in the phone.
export default function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const work = useRef<HTMLCanvasElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let live = true;

    const tick = () => {
      const v = video.current, c = work.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
        const w = 640, h = Math.round((v.videoHeight / v.videoWidth) * 640);
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, w, h);
        const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (hit?.data) {
          live = false;
          onCode(hit.data);
          return;
        }
      }
      if (live) raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("This phone or browser cannot open the camera here. Type the port code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!live) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        raf = requestAnimationFrame(tick);
      } catch {
        setProblem("The camera is blocked. Allow camera access for this site, or type the port code instead.");
      }
    })();

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan the charging port QR code" className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <p className="text-sm font-semibold">Point the camera at the QR on the charging port</p>
        <button type="button" onClick={onClose} aria-label="Close camera" className="rounded-full bg-white/15 p-2"><X size={20} /></button>
      </div>
      <div className="relative flex-1">
        <video ref={video} muted playsInline className="h-full w-full object-cover" />
        <canvas ref={work} className="hidden" />
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-4 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      {problem && <p role="alert" className="bg-white p-4 text-center text-sm text-red-600">{problem}</p>}
    </div>
  );
}
