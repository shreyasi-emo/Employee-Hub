// Shared Express app factory.
//
// Both the persistent local/dev server (server/index.ts) and the Vercel
// serverless function (api/index.ts) build the app through here so the same
// middleware + security posture applies to both. This factory does NOT listen,
// seed, run the scheduler, or attach Vite — those belong to the long-running
// process only. Keep this in sync with the middleware in server/index.ts.
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer, type Server } from "http";
import { registerRoutes } from "./shared/router";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Build a fully-configured Express app (security headers, parsers, session, all
 * routes, error handler). Returns the app plus a non-listening http.Server,
 * because registerRoutes() takes one (it only returns it — nothing listens here).
 */
export async function createApp(): Promise<{ app: express.Express; httpServer: Server }> {
  const app = express();

  // Behind Vercel's TLS-terminating proxy: trust the first hop so req.secure /
  // secure cookies / client IP read X-Forwarded-* correctly.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

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

  app.use(
    express.json({
      // Allow base64-encoded invoice uploads (reimbursement attachments in DB).
      limit: "25mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "25mb" }));

  // Compact API request logging (request line only — never response bodies).
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    });
    next();
  });

  const httpServer = createServer(app);

  // Applies session middleware, then mounts every feature module.
  await registerRoutes(httpServer, app);

  // Central error handler (after routes). Don't leak internal 5xx detail.
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    const message = status >= 500 ? "Internal Server Error" : (err.message || "Request failed");
    res.status(status).json({ message });
  });

  return { app, httpServer };
}
