// Build for Netlify:
//   1. Vite builds the client SPA        -> dist/public   (served from the CDN)
//   2. esbuild bundles the API function  -> netlify/functions-dist/api.js
//
// We pre-bundle the function ourselves (rather than leaning on Netlify's
// bundler) so the `@shared` / `@` tsconfig path aliases resolve deterministically
// — esbuild reads tsconfig.json paths automatically. The output is a single,
// self-contained CommonJS file; netlify.toml ships it with node_bundler = "none".
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, mkdir } from "fs/promises";

async function buildAll() {
  console.log("[netlify] building client (vite)…");
  await viteBuild();

  console.log("[netlify] bundling API function (esbuild)…");
  await rm("netlify/functions-dist", { recursive: true, force: true });
  await mkdir("netlify/functions-dist", { recursive: true });

  await esbuild({
    entryPoints: ["netlify/functions/api.ts"],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    // .cjs (not .js): the root package.json is "type":"module", so a bundled .js
    // would be loaded as ESM and its CommonJS `module.exports` would be ignored.
    outfile: "netlify/functions-dist/api.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    // Optional native add-ons that pure-JS fallbacks cover — never required at runtime.
    external: ["pg-native", "bufferutil", "utf-8-validate", "cpu-features"],
    logLevel: "info",
    minify: false,
  });

  console.log("[netlify] build complete → dist/public + netlify/functions-dist/api.cjs");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
