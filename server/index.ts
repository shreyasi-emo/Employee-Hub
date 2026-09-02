import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { registerRoutes } from "./shared/router";
import { serveStatic } from "./static";
import { startScheduler } from "./scheduler";
import { seed } from "./seed";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Behind Vercel/Netlify/Replit TLS-terminating proxies: trust the first proxy so
// req.secure / secure cookies / client IP (for rate limiting) read X-Forwarded-* correctly.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Baseline security headers. CSP is intentionally left off here (a strict CSP has to be
// tuned against the SPA's assets first — tracked as a follow-up) so the app isn't broken;
// the cross-origin isolation policies are disabled to avoid blocking fonts/SSO redirects.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Throttle credential endpoints only (not /api/auth/me, which the client polls).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});
const CREDENTIAL_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/dev-login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/accept-invite",
]);
app.use((req, res, next) => {
  if (req.method === "POST" && CREDENTIAL_PATHS.has(req.path)) return authLimiter(req, res, next);
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    // Allow base64-encoded invoice uploads (reimbursement attachments stored in DB)
    limit: "25mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "25mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// API responses must never be cached by the browser/proxies — they carry per-user, per-session
// data (e.g. the sanitized directory), and a stale HTTP-cached GET can survive page reloads and
// show yesterday's data. Force revalidation on every /api call.
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log only the request line — never response bodies (they can carry PII / tokens).
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

(async () => {
  try {
    const required = ["DATABASE_URL"];
    // SESSION_SECRET is mandatory in production — never fall back to a shared/known key.
    if (process.env.NODE_ENV === "production") required.push("SESSION_SECRET");
    for (const v of required) {
      if (!process.env[v]) {
        console.error(`Fatal: Missing required environment variable: ${v}`);
        process.exit(1);
      }
    }
    if (!process.env.SESSION_SECRET) {
      // Development only (production is required above): generate a per-boot ephemeral secret
      // so we never sign sessions with an in-repo constant. Sessions reset on restart.
      process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
      console.warn("SESSION_SECRET not set — generated an ephemeral dev secret (sessions reset on restart). Set SESSION_SECRET for stable sessions.");
    }

    log("Starting EMO Employee Hub...");

    // Seed the database on startup (no-op if already seeded).
    await seed();

    await registerRoutes(httpServer, app);
    startScheduler();

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      console.error("Internal Server Error:", err);
      if (res.headersSent) {
        return next(err);
      }
      // Don't leak internal error detail on 5xx — only surface validated 4xx business messages.
      const message = status >= 500 ? "Internal Server Error" : (err.message || "Request failed");
      return res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        // reusePort is not supported on Windows (causes ENOTSUP)
        ...(process.platform !== "win32" ? { reusePort: true } : {}),
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
})();
