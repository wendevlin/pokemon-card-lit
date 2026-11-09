import { defineLazyCard } from "../../lib/lazy-card";
import type { PokemonCardConfig } from "./config";

/** Shows a random Pokémon. Only this definition is in the entry point. */
export const definePokemonCard = (): void =>
  defineLazyCard<PokemonCardConfig>({
    type: "pokemon-card",
    name: "Pokémon",
    description: "Shows a random Pokémon.",
    stubConfig: { show_image: true, show_name: true, show_description: true },
    cardSize: 2,
    card: () => import("./card"),
    editor: () => import("./editor"),
  });
