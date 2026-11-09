import type { BaseCardConfig } from "../../lib/lazy-card";

export interface PokemonCardConfig extends BaseCardConfig {
  /** All `show_*` options default to `true`. */
  show_image?: boolean;
  show_name?: boolean;
  show_description?: boolean;
}

/** The parts of the card a user can hide. */
export const PARTS = ["image", "name", "description"] as const;
export type Part = (typeof PARTS)[number];

export const isShown = (config: PokemonCardConfig, part: Part): boolean => config[`show_${part}`] ?? true;
