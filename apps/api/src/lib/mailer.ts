import nodemailer from "nodemailer";

const {
  SMTP_HOST = "",
  SMTP_PORT = "587",
  SMTP_USER = "",
  SMTP_PASS = "",
  SMTP_FROM = "CloudBox <noreply@cloudboxes.com>",
} = process.env;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!transport) {
    const host = process.env["SMTP_HOST"] || "";
    const port = process.env["SMTP_PORT"] || "587";
    const user = process.env["SMTP_USER"] || "";
    const pass = process.env["SMTP_PASS"] || "";

    if (!host) {
      console.warn("[Mailer] SMTP_HOST not configured — email sending disabled.");
      return null;
    }
    transport = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: user ? { user, pass } : undefined,
    });
  }
  return transport;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransport();
  if (!t) {
    console.error("[Mailer] Cannot send mail: SMTP_HOST environment variable is empty!");
    return;
  }

  const from = process.env["SMTP_FROM"] || "CloudBox <noreply@cloudboxes.in>";

  try {
    const info = await t.sendMail({ from, to, subject, html });
    console.log(`[Mailer] Successfully sent "${subject}" to ${to}. MessageId: ${info.messageId}`);
  } catch (err) {
    console.error(`[Mailer] Failed to send "${subject}" to ${to}:`, err);
  }
}

/**
 * Send a branded email verification OTP to the user.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const subject = "Verify your CloudBox email";
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1b23;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(6,182,212,0.1));">
              <div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#06b6d4);margin-bottom:12px;line-height:48px;text-align:center;">
                <span style="font-size:24px;">☁️</span>
              </div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">CloudBox</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:16px;color:#f8fafc;font-weight:600;">Verify your email address</p>
              <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
                Enter this code to complete your CloudBox signup. It expires in <strong style="color:#f8fafc;">10 minutes</strong>.
              </p>
              <!-- OTP Code -->
              <div style="text-align:center;padding:20px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;margin-bottom:24px;">
                <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#818cf8;font-family:'Courier New',monospace;">
                  ${otp}
                </div>
              </div>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                If you didn't create a CloudBox account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">
                © ${new Date().getFullYear()} CloudBox — Your personal cloud, on your own hardware.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendMail(to, subject, html);
}
