"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import SendPdfButton from "@/components/SendPdfButton";
import { pdfFileName, type PdfSpec } from "@/lib/branded-pdf";
import { registrationLink } from "@/lib/tournament";

// Copy the registration link of one tournament, or send it on WhatsApp as a branded PDF page (with a QR code to scan).
export default function ShareRegistration({ id, name }: { id: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => registrationLink(id);

  async function copy() {
    const link = url();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const t = document.createElement("textarea");
      t.value = link;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* the link is shown on screen anyway */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
        {copied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy link</>}
      </button>
      <SendPdfButton
        label="Share on WhatsApp (PDF)"
        build={(): PdfSpec => {
          const link = url();
          return {
            purpose: "TOURNAMENT", title: `Register your team for ${name}`, subtitle: "Open the link or scan the code to register.", ref: "TEAM REGISTRATION",
            rows: [{ label: "Tournament", value: name }, { label: "Registration link", value: link, link }],
            stepsTitle: "How to register", steps: ["Open the link, or scan the QR code with your phone.", "Enter your team name and the captain's details.", "Submit the form. The Unique Futsal team will confirm."],
            qr: { data: link, label: "Scan to register your team" }, note: "Questions? Call Unique Futsal on 9811940018.",
          };
        }}
        filename={pdfFileName("tournament", name)}
        message={`Register your team for ${name} at Unique Futsal. The details and a QR code are in the attached PDF.`}
        className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
      />
    </div>
  );
}
