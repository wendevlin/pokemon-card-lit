import { watch } from "node:fs";
import { rm } from "node:fs/promises";
import pkg from "./package.json" with { type: "json" };
import { translationsPlugin } from "./translations-plugin";

const dev = process.argv.includes("--dev");
const outdir = "dist";

// Bun resolves the "development" export condition (Lit's dev build) unless
// NODE_ENV is "production" when the process starts, so the scripts set it.
if (!dev && process.env.NODE_ENV !== "production") {
  console.warn('NODE_ENV is not "production": Lit\'s dev build will be bundled. Use `bun run build`.');
}

const build = async (): Promise<void> => {
  const result = await Bun.build({
    entrypoints: ["src/index.ts"],
    outdir,
    // Cards, editors and translations are dynamic imports. Chunks are loaded
    // relative to the card's URL, so dist/ has to be deployed as a whole.
    // The chunks mirror src/, like chunks/cards/random/card-<hash>.js and
    // chunks/translations/de-evolution-card-<hash>.js; shared code sits in chunks/.
    // Releases ship dist/ as one zip, see .github/workflows/release.yml.
    splitting: true,
    naming: { entry: "pokemon-card-lit.js", chunk: "chunks/[dir]/[name]-[hash].[ext]" },
    target: "browser",
    format: "esm",
    minify: !dev,
    sourcemap: dev ? "linked" : "none",
    define: {
      __CARD_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [translationsPlugin("src/translations")],
  });
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    if (!dev) {
      process.exit(1);
    }
    return;
  }
  for (const output of result.outputs) {
    console.info(`${output.path} ${(output.size / 1024).toFixed(2)} kB`);
  }
};

await rm(outdir, { recursive: true, force: true });
await build();

if (dev) {
  console.info("Watching src/ for changes…");
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch("src", { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 50);
  });
}
