import { defineLazyCard } from "../../lib/lazy-card";
import type { EvolutionCardConfig } from "./config";

/** A Pokémon you can evolve with a button. Only this definition is in the entry point. */
export const defineEvolutionCard = (): void =>
  defineLazyCard<EvolutionCardConfig>({
    type: "pokemon-evolution-card",
    name: "Pokémon evolution",
    description: "Evolve a Pokémon with the press of a button.",
    stubConfig: { pokemon: "bulbasaur" },
    cardSize: 2,
    card: () => import("./card"),
    editor: () => import("./editor"),
  });
