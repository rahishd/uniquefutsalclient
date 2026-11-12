"use client";

import { useState } from "react";
import { Lock, Wifi as WifiIcon } from "lucide-react";
import { useSession } from "@/lib/session";
import { useOnCellular, wifiStore, type Wifi } from "@/lib/wifi";
import LockedIcon from "@/components/LockedIcon";
import WifiSheet from "@/components/wifi/WifiSheet";

// Wi-Fi icon next to the Digital ID on Home. Guests see it with a lock (a tap goes to sign in); signed-in customers see it too, with a lock
// until staff have the Wi-Fi on and they are at the venue. A small dot appears when the phone reports it is on mobile data.
// `text`: show it as a small card with the word under the icon (the account card on the phone Home page) instead of a round icon button.
export default function WifiButton({ text }: { text?: string } = {}) {
  const session = useSession();
  const { data } = wifiStore.use();
  const cellular = useOnCellular();
  const [open, setOpen] = useState(false);
  if (!session?.registered) return <LockedIcon label="Venue Wi-Fi" message="Sign in to view the venue Wi-Fi."><WifiIcon size={18} /></LockedIcon>;
  // the icon is always there; it carries a lock while the Wi-Fi is switched off or the customer is not at the venue yet
  const wifi: Extract<Wifi, { visible: true }> = data?.visible ? data : { visible: true, locked: true, message: "The venue Wi-Fi is not available right now. Please ask the staff at the venue." };
  const locked = wifi.locked;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={locked ? "Venue Wi-Fi (locked)" : "Venue Wi-Fi"} className={text ? "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#eaf1ff] px-2 py-3 text-[#0c0b5d]" : "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm"}>
        <WifiIcon size={text ? 22 : 18} />
        {text && <span className="text-[12px] font-semibold leading-none">{text}</span>}
        {locked ? <span aria-hidden className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white ring-2 ring-white"><Lock size={9} /></span>
          : cellular && <span aria-hidden className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />}
      </button>
      {open && <WifiSheet wifi={wifi} onClose={() => setOpen(false)} />}
    </>
  );
}
