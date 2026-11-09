import type { HacCard } from "@home-assistant/components/card/scoped";
import type { BaseCardConfig } from "./lazy-card";
import { type CommonStrings, format } from "./localize";

type CommonEditorStrings = CommonStrings<"editor">;

// Shared by the editors only, so it lives in their chunks, not in the cards'.

/**
 * Minimal types for the form schema of the visual editor. The full types are
 * `HaFormSchema` and `Selector` in the Home Assistant frontend.
 */
export interface SelectorField<C> {
  name: keyof C & string;
  required?: boolean;
  default?: unknown;
  selector: Record<string, unknown>;
}

export interface GridField<C> {
  type: "grid";
  name: "";
  column_min_width?: string;
  schema: FormSchema<C>[];
}

export type FormSchema<C> = SelectorField<C> | GridField<C>;

/** What `getConfigForm()` returns. */
export interface ConfigForm<C> {
  schema: FormSchema<C>[];
  computeLabel?: (schema: { name: string }) => string | undefined;
  computeHelper?: (schema: { name: string }) => string | undefined;
  /** Throwing switches the editor to YAML until the config is valid again. */
  assertConfig?: (config: C) => void;
}

/**
 * The language of the editor. Static methods like `getConfigForm()` get no
 * context, but Home Assistant sets `<html lang>` to the user's language.
 */
export const editorLanguage = (): string => document.documentElement.lang || "en";

/** Looks up `<field>` (labels) or `<field><suffix>` (e.g. `_helper`) in the editor strings. */
export const fieldText =
  (strings: object, suffix = "") =>
  (schema: { name: string }): string | undefined =>
    (strings as Record<string, string>)[`${schema.name}${suffix}`];

const APPEARANCES: readonly HacCard["appearance"][] = ["outlined", "raised"];

export const appearanceField = (strings: CommonEditorStrings): SelectorField<BaseCardConfig> => ({
  name: "appearance",
  selector: {
    select: {
      mode: "dropdown",
      options: APPEARANCES.map((value) => ({ value, label: strings[`appearance_${value}`] })),
    },
  },
});

export const assertAppearance = (config: BaseCardConfig, strings: CommonEditorStrings): void => {
  if (config.appearance !== undefined && !APPEARANCES.includes(config.appearance)) {
    throw new Error(format(strings.invalid_appearance, { options: APPEARANCES.join(", ") }));
  }
};
