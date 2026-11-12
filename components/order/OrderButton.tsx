"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { orderStore } from "@/lib/venueorder";
import LockedIcon from "@/components/LockedIcon";
import OrderIcon from "@/components/order/OrderIcon";
import OrderSheet from "@/components/order/OrderSheet";

// Order icon next to "Hello" on Home (water bottle + Frooty). Registered customers only. A green dot shows while their booked game is on,
// which is the only time they can order; tapping it at other times explains when ordering opens.
// `text`: show it as a small card with the word under the icon (the account card on the phone Home page) instead of a round icon button.
export default function OrderButton({ text }: { text?: string } = {}) {
  const session = useSession();
  const { data } = orderStore.use();
  const [open, setOpen] = useState(false);
  if (!session?.registered) return <LockedIcon label="Order drinks and snacks" message="Sign in to order drinks and snacks."><OrderIcon size={20} /></LockedIcon>;
  const live = Boolean(data?.active);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={live ? "Order drinks and snacks (open now)" : "Order drinks and snacks"}
        className={text ? "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#eaf1ff] px-2 py-3 text-[#0c0b5d]" : "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm"}
      >
        <OrderIcon size={text ? 24 : 20} />
        {text && <span className="text-[12px] font-semibold leading-none">{text}</span>}
        {live && <span aria-hidden className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
      </button>
      {open && <OrderSheet onClose={() => setOpen(false)} />}
    </>
  );
}
