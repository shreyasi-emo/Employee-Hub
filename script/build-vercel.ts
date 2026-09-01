// Build for Vercel:
//   1. Vite builds the client SPA         -> dist/public          (static, served by the CDN)
//   2. esbuild bundles the Express server -> dist/server/vercel.mjs
//
// We pre-bundle the server ourselves so the `@shared` / `@` tsconfig path aliases
// resolve deterministically (esbuild reads tsconfig paths). api/index.ts then
// imports the alias-free bundle — Vercel's function bundler has nothing left to
// resolve, which avoids the runtime FUNCTION_INVOCATION_FAILED crash.
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir } from "fs/promises";

async function run() {
  console.log("[vercel] building client (vite)…");
  await viteBuild();

  console.log("[vercel] bundling server for the API function (esbuild)…");
  await mkdir("dist/server", { recursive: true });
  await esbuild({
    entryPoints: ["server/app.ts"],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "esm",
    outfile: "dist/server/vercel.mjs",
    define: { "process.env.NODE_ENV": '"production"' },
    // Optional native add-ons with pure-JS fallbacks — never required at runtime.
    external: ["pg-native", "bufferutil", "utf-8-validate", "cpu-features"],
    // Some bundled CJS deps call require() at runtime; provide it in the ESM output.
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    logLevel: "info",
  });

  console.log("[vercel] done → dist/public + dist/server/vercel.mjs");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
