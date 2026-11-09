import {
  appearanceField,
  assertAppearance,
  type ConfigForm,
  editorLanguage,
  fieldText,
  type SelectorField,
} from "../../lib/editor-form";
import { loadTranslations } from "../../lib/localize";
import { fetchEvolvableBaseSpecies } from "../../lib/pokeapi-graphql";
import type { EvolutionCardConfig } from "./config";

/** A searchable picker of all base Pokémon that can evolve, or a text field if the list can't be loaded. */
const pokemonField = async (language: string): Promise<SelectorField<EvolutionCardConfig>> => {
  try {
    const species = await fetchEvolvableBaseSpecies(language);
    return {
      name: "pokemon",
      required: true,
      selector: {
        select: {
          // Renders a searchable picker instead of a plain dropdown. It also
          // accepts a typed-in value, e.g. a Pokémon that is not a base stage.
          custom_value: true,
          // The label contains the number, so "#0133" finds Eevee as well as its name does.
          options: species.map(({ id, name, label }) => ({
            value: name,
            label: `#${String(id).padStart(4, "0")} ${label}`,
          })),
        },
      },
    };
  } catch (err) {
    console.warn("[pokemon-evolution-card] Failed to load the Pokémon list", err);
    return { name: "pokemon", required: true, selector: { text: {} } };
  }
};

export const createConfigForm = async (): Promise<ConfigForm<EvolutionCardConfig>> => {
  const language = editorLanguage();
  const [strings, pokemon] = await Promise.all([
    loadTranslations("evolution", "editor", language),
    pokemonField(language),
  ]);

  return {
    schema: [pokemon, appearanceField(strings)],
    computeLabel: fieldText(strings),
    computeHelper: fieldText(strings, "_helper"),
    assertConfig: (config) => assertAppearance(config, strings),
  };
};
