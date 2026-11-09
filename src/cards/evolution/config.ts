import type { BaseCardConfig } from "../../lib/lazy-card";

export interface EvolutionCardConfig extends BaseCardConfig {
  /** Language-independent name of a base Pokémon that can evolve, like "bulbasaur". */
  pokemon?: string;
}
