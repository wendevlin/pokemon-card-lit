import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { BunPlugin } from "bun";

/**
 * Splits the translation files into chunks that load on demand.
 *
 * `src/translations/<language>.json` holds all strings of one language:
 *
 * ```json
 * { "common": { "card": {…}, "editor": {…} }, "evolution": { "card": {…}, "editor": {…} } }
 * ```
 *
 * Every language × section × part ("de" × "evolution" × "card") becomes its
 * own chunk, so a card only downloads its own strings, in one language.
 * Missing strings are filled in from English at build time (with a warning),
 * so a chunk is always complete and the browser never loads two languages.
 *
 * Virtual modules:
 * - `translations:loaders`: the available languages and a dynamic import per chunk
 * - `translations:<language>/<section>/<part>`: the strings of one chunk
 */
export const translationsPlugin = (dir: string): BunPlugin => ({
  name: "translations",
  setup(build) {
    type Strings = Record<string, string>;
    type Translations = Record<string, Record<string, Strings>>;

    const read = async (language: string): Promise<Translations> =>
      (await Bun.file(join(dir, `${language}.json`)).json()) as Translations;

    const languages = async (): Promise<string[]> =>
      (await readdir(dir)).filter((file) => file.endsWith(".json")).map((file) => basename(file, ".json"));

    // A path directly in `dir`, as if the chunk were a file there, so chunk
    // names can use `[dir]` and `[name]`: chunks/translations/de-evolution-card-<hash>.js
    // Not in subfolders: Bun only makes `[dir]` relative if the folder exists.
    const root = resolve(dir);
    build.onResolve({ filter: /^translations:/ }, (args) => ({
      path: join(root, args.path.slice("translations:".length).replaceAll("/", "-")),
      namespace: "translations",
    }));

    const loadLoaders = async () => {
      const en = await read("en");
      const loaders: string[] = [];
      for (const language of await languages()) {
        for (const [section, parts] of Object.entries(en)) {
          for (const [part, strings] of Object.entries(parts)) {
            // Nothing to translate, nothing to load.
            if (Object.keys(strings).length) {
              const key = `${language}/${section}/${part}`;
              loaders.push(`${JSON.stringify(key)}: () => import(${JSON.stringify(`translations:${key}`)})`);
            }
          }
        }
      }
      return {
        loader: "js",
        contents: `export const languages = ${JSON.stringify(await languages())};
export const loaders = {\n${loaders.join(",\n")}\n};`,
      } as const;
    };

    const loadChunk = async (language: string, section: string, part: string) => {
      const source = (await read("en"))[section]?.[part] ?? {};
      const translated = (await read(language))[section]?.[part] ?? {};

      const strings: Strings = {};
      for (const [key, english] of Object.entries(source)) {
        if (translated[key] === undefined) {
          console.warn(`[translations] ${language}: missing ${section}.${part}.${key}, using English`);
        }
        strings[key] = translated[key] ?? english;
      }
      for (const key of Object.keys(translated)) {
        if (!(key in source)) {
          console.warn(`[translations] ${language}: ${section}.${part}.${key} is not in en.json, ignored`);
        }
      }
      return { loader: "js", contents: `export default ${JSON.stringify(strings)};` } as const;
    };

    build.onLoad({ filter: /.*/, namespace: "translations" }, (args) => {
      const name = basename(args.path);
      if (name === "loaders") {
        return loadLoaders();
      }
      // From the end: languages can contain "-" themselves, like "zh-Hans".
      const segments = name.split("-");
      const part = segments.pop();
      const section = segments.pop();
      const language = segments.join("-");
      if (!part || !section || !language) {
        throw new Error(`Unknown translations module: ${args.path}`);
      }
      return loadChunk(language, section, part);
    });
  },
});
