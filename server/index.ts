import "dotenv/config";
import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { startScheduler } from "./scheduler";
import { seed } from "./seed";

// Re-exported for any module that historically imported `log` from here.
export { log };

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
    for (const v of required) {
      if (!process.env[v]) {
        console.error(`Fatal: Missing required environment variable: ${v}`);
        process.exit(1);
      }
    }
    if (!process.env.SESSION_SECRET) {
      console.warn("Warning: SESSION_SECRET not set. Using insecure default. Set it in production.");
    }

    log("Starting EMO Employee Hub...");

    // Seed the database on startup (no-op if already seeded).
    // The serverless (Netlify) path never runs this — seed there via `npm run db:seed`.
    await seed();

    // Build the shared Express app (parsers, session, routes, error handler).
    const { app, httpServer } = await createApp();

    // In-process cron. Not available on serverless; disable with DISABLE_SCHEDULER=true.
    if (process.env.DISABLE_SCHEDULER !== "true") {
      startScheduler();
    }

    // Serve the client. Vite dev middleware in development; static files in prod.
    // Must come AFTER the API routes so its catch-all doesn't shadow them.
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve on the port from PORT (other ports are firewalled). Default 5000.
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
