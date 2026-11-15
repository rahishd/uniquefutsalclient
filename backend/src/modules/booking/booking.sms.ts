import smsService from "../../services/sms.service";
import { renderSms, SmsKey } from "../../services/smsTemplates";
import logger from "../../config/logger";

// The customer's booking texts. Their wording is edited in the admin portal (SMS page) and read through services/smsTemplates.ts.
// They never block or fail a booking: a text that cannot be sent is only logged.
//   requested : the booking was made and waits for the venue (pay at the venue)
//   confirmed : the booking is confirmed (paid online, free game, or confirmed by staff)
//   cancelled : the booking was cancelled (by the customer or by staff)
//   reminder  : one hour before the game
interface SmsBooking {
  code?: string | null;
  id: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  totalPrice?: number | null;
  remainingAmount?: number | null;
}

function dayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export async function sendBookingSms(kind: Extract<SmsKey, "booking_requested" | "booking_confirmed" | "booking_cancelled" | "reminder">, b: SmsBooking, phone?: string | null) {
  const to = phone ?? b.customerPhone;
  if (!to) return;
  try {
    const due = b.remainingAmount && b.remainingAmount > 0 ? ` Please pay Rs. ${b.remainingAmount} at the venue.` : "";
    const message = await renderSms(kind, {
      name: b.customerName || "Customer",
      date: dayDate(b.date),
      time: b.startTime,
      code: b.code || b.id,
      due,
      amount: b.remainingAmount ?? 0,
    });
    await smsService.send({ phoneNumber: to, message, kind, recipientName: b.customerName ?? null, bookingCode: b.code || b.id });
  } catch (err) {
    logger.error(`Failed to send booking ${kind} SMS for ${b.id}`, err);
  }
}

export const smsBookingRequested = (b: SmsBooking) => void sendBookingSms("booking_requested", b);
export const smsBookingConfirmed = (b: SmsBooking) => void sendBookingSms("booking_confirmed", b);
export const smsBookingCancelled = (b: SmsBooking) => void sendBookingSms("booking_cancelled", b);
