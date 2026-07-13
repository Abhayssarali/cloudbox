import nodemailer from "nodemailer";

const {
  SMTP_HOST = "",
  SMTP_PORT = "587",
  SMTP_USER = "",
  SMTP_PASS = "",
  SMTP_FROM = "CloudBox <noreply@cloudbox.com>",
} = process.env;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!transport) {
    if (!SMTP_HOST) {
      console.warn("[Mailer] SMTP_HOST not configured — email sending disabled.");
      return null;
    }
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10),
      secure: parseInt(SMTP_PORT, 10) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransport();
  if (!t) return; // silently skip when SMTP not configured

  try {
    await t.sendMail({ from: SMTP_FROM, to, subject, html });
    console.log(`[Mailer] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`[Mailer] Failed to send "${subject}" to ${to}:`, err);
    // Never propagate — email failures must not break primary flows
  }
}
