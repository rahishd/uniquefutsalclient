// Table-to-PDF export for the Profile page (bookings, games, payments) and the tournament tie-sheet, on the branded Unique Futsal page (lib/branded-pdf.ts).
import { api } from "@/lib/api";
import { downloadPdf as downloadBrandedPdf, type PdfSpec } from "@/lib/branded-pdf";

const W_MM = 148; // the branded page (A5) and its side margins, see lib/branded-pdf.ts
const M_MM = 12;
// jsPDF is loaded only when a customer taps "Download PDF", so it doesn't weigh down the page.

export interface PdfColumn {
  header: string;
  width: number; // points; all columns together should fit in about 515
}

export interface PdfTable {
  filename: string;
  title: string;
  lines?: string[]; // small grey lines under the title (name, totals, ...)
  columns: PdfColumn[];
  rows: string[][];
}

// Every PDF gets its own verification number (made by the server) and a line saying where to check it.
async function issueCode(title: string, details: string): Promise<string | null> {
  try {
    const r = await api<{ code: string }>("/verify/issue", { method: "POST", body: { title, details } });
    return r.code;
  } catch {
    return null; // offline or signed out: the PDF is still made, without a number
  }
}

// The chip in the header: the title itself when it is short, otherwise the part after the colon ("Kala Cup: Tie-sheet" -> "TIE-SHEET").
const chipOf = (title: string) => (title.length <= 22 ? title : title.split(":").pop()!.trim().slice(0, 22)).toUpperCase();

export async function downloadPdf(t: PdfTable) {
  const code = await issueCode(t.title, (t.lines ?? []).join("\n"));
  const total = t.columns.reduce((n, c) => n + c.width, 0);
  const mm = t.columns.map((c) => (c.width / total) * (W_MM - 2 * M_MM)); // the table fills the A5 page
  const spec: PdfSpec = {
    purpose: chipOf(t.title),
    title: t.title,
    subtitle: (t.lines ?? []).filter(Boolean).join("\n") || undefined,
    ref: code ?? undefined,
    table: { head: t.columns.map((c) => c.header), rows: t.rows, widths: mm.slice(1) },
    note: code ? `Verification number: ${code}. Verify this document at Verify Documents in the Unique Futsal app (uniquefutsal.com/verify).` : undefined,
  };
  await downloadBrandedPdf(spec, t.filename);
}
