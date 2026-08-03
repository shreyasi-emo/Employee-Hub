// Netlify serverless entry for the whole Express API.
//
// The entire Express app is wrapped with serverless-http and served from a
// single function. netlify.toml rewrites `/api/*` to this function, so Express
// sees the original `/api/...` paths and every existing route works unchanged.
//
// The app is built once per warm container and cached across invocations.
import serverless from "serverless-http";
import { createApp } from "../../server/app";

let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const { app } = await createApp();
    cachedHandler = serverless(app);
  }
  return cachedHandler;
}

export const handler = async (event: any, context: any) => {
  // Don't wait for the pg pool's idle sockets before returning the response.
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  // Express routes are mounted under /api/*. A Netlify rewrite normally passes
  // the original path (/api/...) straight through, but if the function URL is
  // hit directly the path is prefixed with /.netlify/functions/api — strip it.
  if (typeof event.path === "string" && event.path.startsWith("/.netlify/functions/api")) {
    const rest = event.path.slice("/.netlify/functions/api".length) || "/";
    event.path = rest.startsWith("/api") ? rest : "/api" + (rest === "/" ? "" : rest);
  }

  const h = await getHandler();
  return h(event, context);
};
