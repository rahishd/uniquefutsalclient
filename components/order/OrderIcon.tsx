// A mineral water bottle and a Frooty carton side by side: the Order icon.
export default function OrderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* bottle */}
      <rect x="4.6" y="1.8" width="4" height="2" rx="0.6" />
      <path d="M5.2 3.8v2.3L3.6 8.6V20a1.2 1.2 0 0 0 1.2 1.2h4.4A1.2 1.2 0 0 0 10.4 20V8.6L8.8 6.1V3.8" />
      <path d="M3.6 13h6.8" />
      {/* Frooty carton with a straw */}
      <rect x="13" y="8.6" width="8" height="12.6" rx="1.2" />
      <path d="M13 11.6h8" />
      <path d="M18.2 8.6V4.4l1.8-.9" />
      <circle cx="17" cy="16.4" r="1.8" />
    </svg>
  );
}
