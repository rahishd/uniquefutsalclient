import logger from "../config/logger";

export interface SmsOptions {
  phoneNumber: string;
  message: string;
}

// Two senders, chosen by SMS_PROVIDER in backend/.env:
//   "android" : SMS Gateway for Android in CLOUD mode (sms-gate.app). A phone with our SIM sends the text.
//   "sparrow" : Sparrow SMS bulk gateway (the default when SMS_PROVIDER is not set, as before).
// Every caller uses send(); nothing else in the app knows which one is active.
const PROVIDER = (process.env.SMS_PROVIDER || "sparrow").toLowerCase();

// Nepal numbers are stored as 98XXXXXXXX; the Android gateway wants +97798XXXXXXXX
function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("977")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+977${digits.replace(/^0+/, "")}`;
}

export class SmsService {
  private readonly sparrowUrl = "http://api.sparrowsms.com/v2/sms/";
  private readonly sparrowToken = process.env.SPARROW_SMS_TOKEN || "";
  private readonly sparrowIdentity = process.env.SPARROW_SMS_IDENTITY || "";

  private readonly gateUrl = (process.env.SMSGATE_URL || "https://api.sms-gate.app/3rdparty/v1").replace(/\/+$/, "");
  private readonly gateUser = process.env.SMSGATE_USERNAME || "";
  private readonly gatePass = process.env.SMSGATE_PASSWORD || "";
  private readonly gateSim = Number(process.env.SMSGATE_SIM || 0); // 1 to 3 picks a SIM slot; 0 = the phone's default
  private readonly gateTtl = Number(process.env.SMSGATE_TTL_SECONDS || 3600); // a text still not sent after this is dropped (a stale reminder is worse than none)

  async send(options: SmsOptions): Promise<boolean> {
    return PROVIDER === "android" ? this.sendAndroid(options) : this.sendSparrow(options);
  }

  private async sendAndroid(options: SmsOptions): Promise<boolean> {
    try {
      if (!this.gateUser || !this.gatePass) {
        logger.error("SMS Gateway for Android credentials missing (SMSGATE_USERNAME / SMSGATE_PASSWORD)");
        return false;
      }
      const to = toE164(options.phoneNumber);
      const body: Record<string, unknown> = {
        textMessage: { text: options.message },
        phoneNumbers: [to],
        ttl: this.gateTtl,
        withDeliveryReport: true,
      };
      if (this.gateSim >= 1 && this.gateSim <= 3) body.simNumber = this.gateSim;

      const res = await fetch(`${this.gateUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.gateUser}:${this.gatePass}`).toString("base64")}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; state?: string; message?: string; error?: string };

      // 202 = accepted and queued for the phone (it is sent a moment later, or when the phone is next online)
      if (res.status === 200 || res.status === 201 || res.status === 202) {
        logger.info(`SMS queued for ${to} via Android gateway (id ${data.id ?? "?"})`);
        return true;
      }
      logger.error(`Android SMS gateway error ${res.status}: ${data.message || data.error || "Unknown error"}`);
      return false;
    } catch (error) {
      logger.error("Failed to send SMS via Android gateway", error);
      return false;
    }
  }

  private async sendSparrow(options: SmsOptions): Promise<boolean> {
    try {
      if (!this.sparrowToken || !this.sparrowIdentity) {
        logger.error("Sparrow SMS credentials missing in environment variables");
        return false;
      }

      const params = new URLSearchParams({
        token: this.sparrowToken,
        from: this.sparrowIdentity,
        to: options.phoneNumber,
        text: options.message,
      });

      const response = await fetch(`${this.sparrowUrl}?${params.toString()}`, {
        method: "GET",
      });

      const data = (await response.json()) as any;

      if (response.ok && data.response_code === 200) {
        logger.info(`SMS sent successfully to ${options.phoneNumber}: ${data.response}`);
        return true;
      } else {
        logger.error(`Sparrow SMS error: ${data.response || "Unknown error"} (Code: ${data.response_code})`);
        return false;
      }
    } catch (error) {
      logger.error("Failed to send SMS via Sparrow", error);
      return false;
    }
  }

  async sendBatch(sms: SmsOptions[]): Promise<boolean[]> {
    return Promise.all(sms.map((message) => this.send(message)));
  }
}

export default new SmsService();
