const API = "https://pokeapi.co/api/v2";
const ARTWORK =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

/** Highest National Pokédex number with species data. */
const MAX_ID = 1025;

interface LocalizedName {
  name: string;
  language: { name: string };
}

interface FlavorTextEntry {
  flavor_text: string;
  language: { name: string };
}

/** Subset of `GET /pokemon-species/{id or name}`. */
interface PokemonSpecies {
  id: number;
  name: string;
  names: LocalizedName[];
  flavor_text_entries: FlavorTextEntry[];
  evolution_chain: { url: string };
}

/** Subset of a link in `GET /evolution-chain/{id}`. */
interface ChainLink {
  species: { url: string };
  evolves_to: ChainLink[];
}

export interface Pokemon {
  id: number;
  name: string;
  description: string;
  image: string;
  /** URL of the evolution chain, for `fetchEvolutionChain`. */
  evolutionChain: string;
}

/** A species in an evolution chain, with the species it can evolve into. */
export interface EvolutionNode {
  id: number;
  evolvesTo: EvolutionNode[];
}

/** Picks the entry in `language` ("de-AT"), its base language ("de"), or English. */
export const pickLanguage = <T extends { language: { name: string } }>(
  entries: T[],
  language: string,
): T | undefined => {
  for (const candidate of [language, language.split("-")[0], "en"]) {
    const entry = entries.find((e) => e.language.name === candidate);
    if (entry) {
      return entry;
    }
  }
  return undefined;
};

// Flavor texts come from the games and keep their line and page breaks.
const cleanText = (text: string): string => text.replace(/[\f\n\r­]+/g, " ").trim();

const idFromUrl = (url: string): number => Number(url.match(/\/(\d+)\/?$/)?.[1]);

export const randomPokemonId = (): number => Math.floor(Math.random() * MAX_ID) + 1;

/** Loads a Pokémon by ID or name, with its name and description in `language` when available. */
export const fetchPokemon = async (
  species: number | string,
  language: string,
  signal?: AbortSignal,
): Promise<Pokemon> => {
  const key = encodeURIComponent(String(species).trim().toLowerCase());
  const response = await fetch(`${API}/pokemon-species/${key}`, { signal });
  if (!response.ok) {
    throw new Error(`PokéAPI responded with ${response.status}`);
  }
  const data = (await response.json()) as PokemonSpecies;
  const flavor = pickLanguage(data.flavor_text_entries, language);
  return {
    id: data.id,
    name: pickLanguage(data.names, language)?.name ?? data.name,
    description: flavor ? cleanText(flavor.flavor_text) : "",
    image: `${ARTWORK}/${data.id}.png`,
    evolutionChain: data.evolution_chain.url,
  };
};

const chains = new Map<string, Promise<EvolutionNode>>();

/** Loads an evolution chain, once per page: chains don't change. */
export const fetchEvolutionChain = (url: string): Promise<EvolutionNode> => {
  let chain = chains.get(url);
  if (!chain) {
    chain = (async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`PokéAPI responded with ${response.status}`);
      }
      const toNode = (link: ChainLink): EvolutionNode => ({
        id: idFromUrl(link.species.url),
        evolvesTo: link.evolves_to.map(toNode),
      });
      return toNode(((await response.json()) as { chain: ChainLink }).chain);
    })();
    // Don't cache failures, so the next attempt fetches again.
    chain.catch(() => chains.delete(url));
    chains.set(url, chain);
  }
  return chain;
};

export const findInChain = (node: EvolutionNode, id: number): EvolutionNode | undefined => {
  if (node.id === id) {
    return node;
  }
  for (const next of node.evolvesTo) {
    const found = findInChain(next, id);
    if (found) {
      return found;
    }
  }
  return undefined;
};
