// Central email sender.
// - When SENDGRID_API_KEY is set, it delivers via SendGrid (SENDGRID_FROM_EMAIL as the sender).
// - Otherwise it falls back to a dev/dummy sender that logs the message to the server console,
//   so email-driven flows are fully testable without a provider. Set the env vars later and real
//   delivery turns on with no code change.
export async function sendEmail(opts: { to: string; subject: string; html?: string; text?: string }): Promise<{ sent: boolean; dev: boolean }> {
  if (!opts.to) return { sent: false, dev: false };
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL || "noreply@emoenergy.in";

  if (!key) {
    console.log("\n📧 [dev email — not actually sent; set SENDGRID_API_KEY to enable delivery]");
    console.log("   to:      " + opts.to);
    console.log("   subject: " + opts.subject);
    if (opts.text) console.log("   text:\n" + opts.text.split("\n").map((l) => "     " + l).join("\n"));
    console.log("");
    return { sent: false, dev: true };
  }

  try {
    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(key);
    await sgMail.send({ to: opts.to, from, subject: opts.subject, html: opts.html, text: opts.text || opts.subject });
    return { sent: true, dev: false };
  } catch (e) {
    console.error("sendEmail failed:", (e as any)?.message || e);
    return { sent: false, dev: false };
  }
}
