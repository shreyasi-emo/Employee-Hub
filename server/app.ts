// Shared Express app factory.
//
// Both the persistent local/dev server (server/index.ts) and the Netlify
// serverless function (netlify/functions/api.ts) build the app through here so
// there is exactly one place that wires middleware + routes. This factory does
// NOT listen, seed, run the scheduler, or attach Vite — those are concerns of
// the long-running process only, not the serverless request path.
import express, { type Request, Response, NextFunction } from "express";
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
 * Build a fully-configured Express app (parsers, session, all routes, error
 * handler). Returns the app plus a non-listening http.Server, because
 * registerRoutes() takes one (it only returns it — nothing listens here).
 */
export async function createApp(): Promise<{ app: express.Express; httpServer: Server }> {
  const app = express();

  // Behind Netlify's proxy (and most PaaS proxies) we must trust the first hop
  // so `secure` session cookies are set over the forwarded HTTPS connection.
  app.set("trust proxy", 1);

  app.use(
    express.json({
      // Allow base64-encoded invoice uploads (reimbursement attachments in DB).
      // NOTE: Netlify sync functions cap request bodies at ~6MB — see DEPLOY notes.
      limit: "25mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "25mb" }));

  // Compact API request logging (skipped for non-/api paths).
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        log(logLine.length > 300 ? logLine.slice(0, 299) + "…" : logLine);
      }
    });
    next();
  });

  const httpServer = createServer(app);

  // Applies session middleware, then mounts every feature module.
  await registerRoutes(httpServer, app);

  // Central error handler (must come after routes).
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    res.status(status).json({ message });
  });

  return { app, httpServer };
}
