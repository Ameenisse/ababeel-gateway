import crypto from "node:crypto";

/**
 * Enterprise-grade PIN hashing using Node.js native scrypt.
 * Output format: scrypt:<salt>:<derivedKeyHex>
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(pin, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a PIN against a stored scrypt hash with timing-safe comparison.
 */
export function verifyPin(pin: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;
  try {
    const parts = storedHash.split(":");
    if (parts.length === 3 && parts[0] === "scrypt") {
      const salt = parts[1];
      const expectedKey = Buffer.from(parts[2], "hex");
      const derivedKey = crypto.scryptSync(pin, salt, 64);
      if (expectedKey.length !== derivedKey.length) return false;
      return crypto.timingSafeEqual(expectedKey, derivedKey);
    }
  } catch (err) {
    console.error("[PIN Verify Error]:", err);
  }
  return false;
}

/**
 * Extracts the last 4 numeric digits from a student NID string.
 * e.g., 'A123456' -> '3456'
 * Returns null if fewer than 4 digits are present.
 */
export function extractPinFromNid(nid?: string | null): string | null {
  if (!nid) return null;
  const digits = nid.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export type EmailDeliveryResult = {
  status: "sent" | "failed" | "pending_retry";
  error?: string;
  messageId?: string;
};

/**
 * Send transactional email to applicant Google email.
 * Adheres to rule: Do NOT create a fake "Email Sent" state if no email provider is configured.
 */
export async function sendAdmissionCredentialsEmail(params: {
  recipientEmail: string;
  recipientName: string;
  studentName: string;
  studentNumber: string;
  username: string;
  temporaryPin: string;
  assignedClassName: string;
  siteUrl?: string;
}): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const loginUrl = `${params.siteUrl || "https://ababeel.mv"}/student-login`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 8px; color: #1a202c;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 22px;">Ababeel Quran Class</h1>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Admission Approved — Student Portal Credentials</p>
      </div>

      <p>Assalaamu Alaikum <strong>${params.recipientName || params.studentName}</strong>,</p>
      <p>Alhamdulillah! The admission application for <strong>${params.studentName}</strong> has been <strong>approved</strong>.</p>

      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 16px;">Student Portal Credentials</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 40%;">Student Name:</td>
            <td style="padding: 6px 0; font-weight: bold;">${params.studentName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Student ID (Number):</td>
            <td style="padding: 6px 0; font-weight: bold; font-family: monospace;">${params.studentNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Assigned Class:</td>
            <td style="padding: 6px 0; font-weight: bold;">${params.assignedClassName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Portal Username:</td>
            <td style="padding: 6px 0; font-weight: bold; font-family: monospace; color: #0f766e;">${params.username}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Temporary Initial PIN:</td>
            <td style="padding: 6px 0; font-weight: bold; font-family: monospace; font-size: 18px; color: #b91c1c;">${params.temporaryPin}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin: 16px 0;">
        <strong style="color: #991b1b; font-size: 13px;">Security Notice:</strong>
        <p style="margin: 4px 0 0 0; color: #b91c1c; font-size: 13px;">
          This 4-digit PIN is temporary (derived from the last 4 digits of the Student NID). For security, you will be required to change your PIN upon first login before accessing the Student Dashboard.
        </p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
          Log In to Student Portal
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        Ababeel Quran Class • Official Admission Notification<br />
        Please keep this notification confidential.
      </p>
    </div>
  `;

  const text = `Ababeel Quran Class — Admission Approved

Assalaamu Alaikum ${params.recipientName || params.studentName},

The admission application for ${params.studentName} has been approved.

Student Portal Credentials:
- Student Name: ${params.studentName}
- Student ID: ${params.studentNumber}
- Assigned Class: ${params.assignedClassName}
- Username: ${params.username}
- Temporary PIN: ${params.temporaryPin}

Security Notice:
For security, please change the temporary PIN after the first login at ${loginUrl}.

Ababeel Quran Class`;

  if (!apiKey) {
    console.warn(
      `[Email Service Warning]: RESEND_API_KEY not set. Cannot dispatch email to ${params.recipientEmail}. Credentials displayed to admin and recorded for retry.`,
    );
    return {
      status: "failed",
      error:
        "No transactional email service configured (RESEND_API_KEY is not set). Admin can view credentials and resend anytime.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ababeel Quran Class <admissions@ababeel.mv>",
        to: [params.recipientEmail],
        subject: "Ababeel Quran Class — Admission Approved",
        html,
        text,
      }),
    });

    const data = (await res.json()) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return {
        status: "failed",
        error: data.message || `HTTP ${res.status}: Failed to send email via Resend`,
      };
    }

    return {
      status: "sent",
      messageId: data.id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Email Dispatch Exception]:", msg);
    return {
      status: "failed",
      error: msg,
    };
  }
}
