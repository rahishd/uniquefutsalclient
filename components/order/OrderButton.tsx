"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { orderStore } from "@/lib/venueorder";
import OrderIcon from "@/components/order/OrderIcon";
import OrderSheet from "@/components/order/OrderSheet";

// Order icon next to "Hello" on Home (water bottle + Frooty). Registered customers only. A green dot shows while their booked game is on,
// which is the only time they can order; tapping it at other times explains when ordering opens.
export default function OrderButton() {
  const session = useSession();
  const { data } = orderStore.use();
  const [open, setOpen] = useState(false);
  if (!session?.registered) return null;
  const live = Boolean(data?.active);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={live ? "Order drinks and snacks (open now)" : "Order drinks and snacks"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm"
      >
        <OrderIcon size={20} />
        {live && <span aria-hidden className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
      </button>
      {open && <OrderSheet onClose={() => setOpen(false)} />}
    </>
  );
}
