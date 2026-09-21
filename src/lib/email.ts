// Thin wrapper around Resend (https://resend.com) for the two places this
// app sends email: password reset links and admin sync-failure alerts.
//
// Without a domain verified in Resend, its default `onboarding@resend.dev`
// sender can only deliver to the email address the Resend account itself
// was created with — fine for admin alerts (sent to the site owner), not
// guaranteed for password resets to arbitrary players until a real domain
// is verified there. That's a Resend account-level setup step, not
// something this code can work around.
//
// If RESEND_API_KEY isn't set at all, sendEmail logs the message instead of
// sending it (and reports itself as failed) rather than throwing — lets the
// app run locally, and in production surfaces as a clear, catchable error
// instead of a crash.

import { Resend } from "resend";

export type SendEmailResult = { ok: true } | { ok: false; error: string };

const DEFAULT_FROM = "Fantasy NASCAR HQ <onboarding@resend.dev>";

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — logging instead of sending.\nTo: ${params.to}\nSubject: ${params.subject}\n${params.html}`,
    );
    return { ok: false, error: "Email isn't configured yet (RESEND_API_KEY missing)." };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "Reset your Fantasy NASCAR HQ password",
    html: `
      <p>Someone (hopefully you) asked to reset the password on this account.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a>. This link works once and expires in 30 minutes.</p>
      <p>If you didn't ask for this, you can ignore this email — your password hasn't changed.</p>
    `,
  });
}

export async function sendResultsPostedEmail(
  to: string,
  params: { trackName: string; week: number; raceUrl: string },
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Results are in: Week ${params.week} — ${params.trackName}`,
    html: `
      <p>Results are posted for Week ${params.week} — ${params.trackName}.</p>
      <p><a href="${params.raceUrl}">See the results</a>, then check your leagues to see how you scored.</p>
      <p><small>You're getting this because results notifications are on for your account — turn them off any time from Settings.</small></p>
    `,
  });
}

export async function sendSyncFailureAlert(to: string, details: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "Fantasy NASCAR HQ: NASCAR data sync is failing",
    html: `
      <p>The automated NASCAR data sync hit a problem and needs a look:</p>
      <pre style="white-space: pre-wrap; font-family: monospace; background: #f4f4f4; padding: 12px; border-radius: 6px;">${details}</pre>
      <p>You won't get another one of these for at least an hour, even if it keeps failing.</p>
    `,
  });
}
