// Google SSO — the only login. Company-domain emails only.
import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { storage } from "./storage";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "")
  .split(",").map(d => d.trim().toLowerCase()).filter(Boolean);

export function googleStart(_req: Request, res: Response) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).send("Google SSO not configured. Set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.");
  }
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
  });
  res.redirect(url);
}

export async function googleCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing code");

    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return res.status(401).send("No id_token from Google");

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      return res.status(401).send("Email not verified by Google");
    }

    const email = payload.email.toLowerCase();
    const domain = email.split("@")[1];
    if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(domain)) {
      return res.status(403).send(`Email domain not permitted. Use your @${ALLOWED_DOMAINS[0]} address.`);
    }

    const user = await storage.getUserByEmail(email);
    if (!user || !user.isActive) {
      return res.status(403).send("No active account for this email. Contact HR.");
    }

    req.session.userId = user.id;
    res.redirect("/");
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).send("Authentication failed");
  }
}

export function logout(req: Request, res: Response) {
  req.session.destroy(() => res.json({ ok: true }));
}
