// Vercel serverless entry for the whole Express API.
//
// The Express app is pre-bundled by `npm run build:vercel` into
// dist/server/vercel.mjs — esbuild resolves every import (including the
// `@shared/*` path aliases) and inlines them, so Vercel's function bundler has
// nothing left to resolve. Importing `../server/app` directly made Vercel fail
// to resolve `@shared/*` at runtime → FUNCTION_INVOCATION_FAILED.
//
// vercel.json rewrites `/api/*` here; the Express app handles routing under /api/*.
// @ts-ignore - generated at build time by script/build-vercel.ts
import { createApp } from "../dist/server/vercel.mjs";

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) appPromise = createApp().then((r: any) => r.app);
  return appPromise;
}

export default async function handler(req: any, res: any) {
  // Express routes are mounted under /api/*. Guard the case where the path
  // arrives without the /api prefix so route matching never silently 404s.
  if (typeof req.url === "string" && !req.url.startsWith("/api")) {
    req.url = "/api" + (req.url === "/" ? "" : req.url);
  }
  const app = await getApp();
  return app(req, res);
}
