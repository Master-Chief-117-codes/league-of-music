export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    console.warn("Twilio not configured — skipping SMS to", to);
    return;
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    }
  );
  if (!res.ok) console.error("Twilio error:", await res.text());
}

/** Normalize a user-entered number to E.164. Returns null if unparseable. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;           // US 10-digit
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`; // US with country code
  if (digits.length > 7) return `+${digits}`;               // international — trust the user
  return null;
}
