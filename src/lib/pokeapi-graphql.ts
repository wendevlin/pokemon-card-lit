import { pickLanguage } from "./pokeapi";

// Separate from pokeapi.ts on purpose: only the editor imports this module, so
// the bundler keeps it out of the card's chunks.

const GRAPHQL = "https://graphql.pokeapi.co/v1beta2";

/** Base species (they don't evolve from another one) whose chain has more than one species. */
const BASE_SPECIES_QUERY = `
  query BaseSpecies($languages: [String!]) {
    pokemonspecies(
      where: {
        evolves_from_species_id: { _is_null: true }
        evolutionchain: { pokemonspecies_aggregate: { count: { predicate: { _gt: 1 } } } }
      }
      order_by: { id: asc }
    ) {
      id
      name
      pokemonspeciesnames(where: { language: { name: { _in: $languages } } }) {
        name
        language { name }
      }
    }
  }
`;

interface BaseSpeciesResponse {
  data?: {
    pokemonspecies: {
      id: number;
      name: string;
      pokemonspeciesnames: { name: string; language: { name: string } }[];
    }[];
  };
  errors?: { message: string }[];
}

export interface SpeciesOption {
  id: number;
  /** Language-independent name, like "bulbasaur". */
  name: string;
  /** Name in the requested language, like "Bisasam". */
  label: string;
}

const cache = new Map<string, Promise<SpeciesOption[]>>();

/** Lists all base Pokémon that can evolve, in one request. Cached per language. */
export const fetchEvolvableBaseSpecies = (language: string): Promise<SpeciesOption[]> => {
  let options = cache.get(language);
  if (!options) {
    options = (async () => {
      const response = await fetch(GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: BASE_SPECIES_QUERY,
          variables: { languages: [language, language.split("-")[0], "en"] },
        }),
      });
      const result = (await response.json()) as BaseSpeciesResponse;
      if (!response.ok || !result.data) {
        throw new Error(result.errors?.[0]?.message ?? `PokéAPI GraphQL responded with ${response.status}`);
      }
      return result.data.pokemonspecies.map((species) => ({
        id: species.id,
        name: species.name,
        label: pickLanguage(species.pokemonspeciesnames, language)?.name ?? species.name,
      }));
    })();
    options.catch(() => cache.delete(language));
    cache.set(language, options);
  }
  return options;
};
