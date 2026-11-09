/**
 * Tests the release zip the way the Marketplace installs it: unpacked into a
 * folder and served under /hacsfiles/<repository>/, with the entry point at the
 * root of the zip and the chunks in subfolders.
 *
 * ```sh
 * bun run test:release   # packs the zip first
 * ```
 *
 * In headless Chrome, it registers the cards, mounts both of them in German
 * (Home Assistant's language context is faked) and opens both editors. The
 * PokéAPI is mocked. Any failed request, page error or console error fails
 * the test, so a chunk with a broken relative path is caught.
 */
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { $ } from "bun";
import { chromium, type Page, type Route } from "playwright-core";

const root = resolve(import.meta.dir, "..");
const zip = join(root, "pokemon-card-lit.zip");
const BASE = "/hacsfiles/pokemon-card-lit/";
const ENTRY = "pokemon-card-lit.js";

declare global {
  /** Defined by the test page. */
  function cardRoot(tag: string): ShadowRoot | null | undefined;
}

// --- Unpack the zip ---------------------------------------------------------

if (!(await Bun.file(zip).exists())) {
  throw new Error(`${relative(root, zip)} is missing, run \`bun run package\` first`);
}
const dir = await mkdtemp(join(tmpdir(), "pokemon-card-lit-release-"));
await $`unzip -q ${zip} -d ${dir}`;
const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
  .sort();
console.info(`Zip contents (${files.length} files):\n${files.map((file) => `  ${file}`).join("\n")}`);

const failures: string[] = [];
const check = (ok: boolean, message: string): void => {
  console.info(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) {
    failures.push(message);
  }
};

check(files.includes(ENTRY), `${ENTRY} is at the root of the zip`);
check(
  files.some((file) => file.includes("/")),
  "the chunks are in subfolders",
);

// --- Serve it like the Marketplace ------------------------------------------

const page = `<!doctype html>
<html lang="de">
  <body>
    <script type="module">
      // Fakes Home Assistant's i18n context provider (@lit/context protocol).
      document.addEventListener("context-request", (event) => {
        if (event.context === "hassInternationalization") {
          event.stopPropagation();
          event.callback({ language: "de" }, () => {});
        }
      });
      // The shadow root of a card's Lit element: <tag> → <tag>-content.
      window.cardRoot = (tag) =>
        document.querySelector(tag)?.shadowRoot?.querySelector(\`\${tag}-content\`)?.shadowRoot;
      await import("${BASE}${ENTRY}");
      window.loaded = true;
    </script>
  </body>
</html>`;

const server = Bun.serve({
  port: 0,
  fetch: async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/") {
      return new Response(page, { headers: { "Content-Type": "text/html" } });
    }
    if (pathname.startsWith(BASE)) {
      const file = Bun.file(join(dir, pathname.slice(BASE.length)));
      if (await file.exists()) {
        return new Response(file);
      }
    }
    return new Response("Not found", { status: 404 });
  },
});

// --- PokéAPI mocks ----------------------------------------------------------

const SPECIES: Record<string, { id: number; en: string; de: string }> = {
  "1": { id: 1, en: "Bulbasaur", de: "Bisasam" },
  bulbasaur: { id: 1, en: "Bulbasaur", de: "Bisasam" },
  "2": { id: 2, en: "Ivysaur", de: "Bisaknosp" },
};
const CHAIN = "https://pokeapi.co/api/v2/evolution-chain/1/";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const mockApi = async (page: Page): Promise<void> => {
  await page.route("https://pokeapi.co/api/v2/pokemon-species/*", (route: Route) => {
    const key = new URL(route.request().url()).pathname.split("/").pop()!;
    // Every random ID gets Bulbasaur, so the test knows the name.
    const species = SPECIES[key] ?? SPECIES["1"]!;
    return route.fulfill({
      json: {
        id: species.id,
        name: species.en.toLowerCase(),
        names: [
          { name: species.en, language: { name: "en" } },
          { name: species.de, language: { name: "de" } },
        ],
        flavor_text_entries: [{ flavor_text: "Ein Samen.", language: { name: "de" } }],
        evolution_chain: { url: CHAIN },
      },
    });
  });
  await page.route(CHAIN, (route) =>
    route.fulfill({
      json: {
        chain: {
          species: { url: "https://pokeapi.co/api/v2/pokemon-species/1/" },
          evolves_to: [{ species: { url: "https://pokeapi.co/api/v2/pokemon-species/2/" }, evolves_to: [] }],
        },
      },
    }),
  );
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ body: PNG, contentType: "image/png" }),
  );
  await page.route("https://graphql.pokeapi.co/**", (route) =>
    route.fulfill({
      json: {
        data: {
          pokemonspecies: [
            {
              id: 1,
              name: "bulbasaur",
              pokemonspeciesnames: [{ name: "Bisasam", language: { name: "de" } }],
            },
          ],
        },
      },
    }),
  );
};

// --- Run it in Chrome -------------------------------------------------------

const browser = await chromium.launch({ channel: "chrome" });
try {
  const tab = await browser.newPage();
  const loaded: string[] = [];
  tab.on("pageerror", (err) => failures.push(`page error: ${err.message}`));
  tab.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console error: ${message.text()}`);
    }
  });
  tab.on("requestfailed", (request) => failures.push(`request failed: ${request.url()}`));
  tab.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400) {
      failures.push(`HTTP ${response.status()}: ${response.url()}`);
    } else if (url.pathname.startsWith(BASE)) {
      loaded.push(url.pathname.slice(BASE.length));
    }
  });
  await mockApi(tab);

  await tab.goto(`http://localhost:${server.port}/`);
  await tab.waitForFunction(() => (window as { loaded?: boolean }).loaded === true);

  const registered = await tab.evaluate(() => window.customCards?.map((card) => card.type));
  check(
    JSON.stringify(registered) === JSON.stringify(["pokemon-card", "pokemon-evolution-card"]),
    `both cards are registered for the card picker (${registered?.join(", ")})`,
  );
  // Besides the entry point, only Bun's small runtime chunk (chunk preloading,
  // decorators) loads up front: no card, editor or translation.
  check(
    !loaded.some((file) => file.startsWith("chunks/cards/") || file.startsWith("chunks/translations/")),
    `no card code loads before a card is used (${loaded.join(", ")})`,
  );

  // The random card, in German.
  await tab.evaluate(() => {
    const card = document.createElement("pokemon-card") as HTMLElement & { setConfig(c: object): void };
    card.setConfig({ type: "custom:pokemon-card" });
    document.body.append(card);
  });
  const randomName = await tab
    .waitForFunction(() => cardRoot("pokemon-card")?.querySelector("h2")?.textContent)
    .then((handle) => handle.jsonValue());
  check(randomName === "Bisasam", `the random card shows a Pokémon in German (${randomName})`);

  const scoped = await tab.evaluate(() => {
    const hacCard = cardRoot("pokemon-card")!.querySelector("hac-card")!;
    return {
      hacCardUpgraded: hacCard.constructor !== HTMLElement,
      hacCardGlobal: customElements.get("hac-card") !== undefined,
      contentGlobal: customElements.get("pokemon-card-content") !== undefined,
    };
  });
  check(scoped.hacCardUpgraded, "<hac-card> is upgraded inside the card");
  console.info(
    `  (scoped registries: <hac-card> ${scoped.hacCardGlobal ? "global" : "scoped"}, ` +
      `<pokemon-card-content> ${scoped.contentGlobal ? "global" : "scoped"})`,
  );

  // The evolution card, evolved once.
  await tab.evaluate(() => {
    const card = document.createElement("pokemon-evolution-card") as HTMLElement & {
      setConfig(c: object): void;
    };
    card.setConfig({ type: "custom:pokemon-evolution-card", pokemon: "bulbasaur" });
    document.body.append(card);
  });
  const button = await tab
    .waitForFunction(() =>
      cardRoot("pokemon-evolution-card")?.querySelector("button.evolve")?.textContent?.trim(),
    )
    .then((handle) => handle.jsonValue());
  check(button === "Entwickeln", `the evolution card has a German button (${button})`);
  await tab.evaluate(() =>
    cardRoot("pokemon-evolution-card")!.querySelector<HTMLElement>("button.evolve")!.click(),
  );
  const evolved = await tab
    .waitForFunction(() => {
      const name = cardRoot("pokemon-evolution-card")?.querySelector("h2")?.textContent;
      return name === "Bisaknosp" && name;
    })
    .then((handle) => handle.jsonValue());
  check(evolved === "Bisaknosp", `evolving loads the next stage (${evolved})`);

  // Both editors, in German (Home Assistant sets <html lang>).
  const editors = await tab.evaluate(async () => {
    type Form = {
      schema: { selector?: { select?: { options: unknown[] } } }[];
      computeLabel(s: { name: string }): string | undefined;
      computeHelper?(s: { name: string }): string | undefined;
    };
    const form = (type: string) =>
      (customElements.get(type) as unknown as { getConfigForm(): Promise<Form> }).getConfigForm();
    const random = await form("pokemon-card");
    const evolution = await form("pokemon-evolution-card");
    return {
      showImage: random.computeLabel({ name: "show_image" }),
      appearance: random.computeLabel({ name: "appearance" }),
      pokemonHelper: evolution.computeHelper?.({ name: "pokemon" }),
      pokemonOptions: evolution.schema[0]?.selector?.select?.options.length ?? 0,
    };
  });
  check(editors.showImage === "Bild anzeigen", `the random editor is German (${editors.showImage})`);
  check(editors.appearance === "Darstellung", `the shared editor strings are German (${editors.appearance})`);
  check(
    editors.pokemonHelper === "Nur Pokémon, die sich entwickeln können.",
    `the evolution editor is German (${editors.pokemonHelper})`,
  );
  check(editors.pokemonOptions > 0, "the evolution editor lists Pokémon");

  console.info(`Loaded from the zip:\n${[...new Set(loaded)].map((file) => `  ${file}`).join("\n")}`);
  check(
    loaded.some((file) => file.startsWith("chunks/cards/")) &&
      loaded.some((file) => file.startsWith("chunks/translations/")),
    "cards and translations load from their subfolders",
  );
} finally {
  await browser.close();
  server.stop(true);
  await rm(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.info("\nThe release zip works.");
