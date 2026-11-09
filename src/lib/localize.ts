import { languages, loaders } from "translations:loaders";
import type en from "../translations/en.json";

// The strings live in src/translations/<language>.json. The build splits them
// into one chunk per language, section and part (see translations-plugin.ts),
// already completed with English, so only the chunks a card needs are fetched.

type Source = typeof en;

/** A card's section in the translation files. */
export type Section = Exclude<keyof Source, "common">;
/** `card` for the card itself, `editor` for its visual editor. */
export type Part = "card" | "editor";

/** The shared strings of a part, available to every card. */
export type CommonStrings<P extends Part> = Source["common"][P];

/** The shared strings of a part plus the ones of a section. */
export type Strings<S extends Section, P extends Part> = CommonStrings<P> & Source[S][P];

type Chunk = Record<string, string>;

/** Picks the language we have translations for: "de-AT" → "de", unknown → "en". */
const resolveLanguage = (language: string): string =>
  [language, language.split("-")[0]!].find((candidate) => languages.includes(candidate)) ?? "en";

const loadChunk = async (language: string, section: string, part: Part): Promise<Chunk> => {
  const load = loaders[`${language}/${section}/${part}`];
  if (!load) {
    // Nothing to translate in this part, like `random.card`.
    return {};
  }
  try {
    return (await load()).default;
  } catch (err) {
    if (language === "en") {
      throw err;
    }
    // E.g. the chunk could not be fetched; English is better than nothing.
    console.warn(`Failed to load "${language}" translations, using English`, err);
    return loadChunk("en", section, part);
  }
};

/**
 * Loads the strings of a card (`section`) for its card or its editor (`part`),
 * together with the shared `common` strings of that part:
 *
 * ```ts
 * const strings = await loadTranslations("evolution", "card", "de-AT");
 * strings.evolve;     // "Entwickeln", from evolution.card
 * strings.load_error; // from common.card
 * ```
 *
 * The browser caches each chunk, so loading the same strings again is free.
 */
export const loadTranslations = async <S extends Section, P extends Part>(
  section: S,
  part: P,
  language: string,
): Promise<Strings<S, P>> => {
  const resolved = resolveLanguage(language);
  const [common, own] = await Promise.all([
    loadChunk(resolved, "common", part),
    loadChunk(resolved, section, part),
  ]);
  // The build completes every chunk with English, so all keys of en.json are there.
  return { ...common, ...own } as unknown as Strings<S, P>;
};

/** Replaces `{name}` placeholders in a translated string. */
export const format = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
