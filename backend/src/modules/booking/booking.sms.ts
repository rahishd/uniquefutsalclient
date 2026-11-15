import smsService from "../../services/sms.service";
import logger from "../../config/logger";

// The customer's booking texts. They never block or fail a booking: a text that cannot be sent is only logged.
//   requested : the booking was made and waits for the venue (pay at the venue)
//   confirmed : the booking is confirmed (paid online, free game, or confirmed by staff)
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

function send(kind: string, b: SmsBooking, message: string) {
  if (!b.customerPhone) return;
  smsService.send({ phoneNumber: b.customerPhone, message }).catch((err) => logger.error(`Failed to send booking ${kind} SMS for ${b.id}`, err));
}

export function smsBookingRequested(b: SmsBooking) {
  const name = b.customerName || "Customer";
  send("requested", b, `Dear ${name}, we received your booking request for ${b.startTime} on ${dayDate(b.date)}. It is awaiting confirmation from Unique Futsal; we will text you once it is confirmed. Code ${b.code || b.id}.`);
}

export function smsBookingConfirmed(b: SmsBooking) {
  const name = b.customerName || "Customer";
  const due = b.remainingAmount && b.remainingAmount > 0 ? ` Please pay Rs. ${b.remainingAmount} at the venue.` : "";
  send("confirmed", b, `Dear ${name}, your booking is confirmed for ${b.startTime} on ${dayDate(b.date)}.${due} Please arrive 10 minutes early. Code ${b.code || b.id}. - Unique Futsal`);
}
