import {
  appearanceField,
  assertAppearance,
  type ConfigForm,
  editorLanguage,
  fieldText,
} from "../../lib/editor-form";
import { loadTranslations } from "../../lib/localize";
import { PARTS, type PokemonCardConfig } from "./config";

export const createConfigForm = async (): Promise<ConfigForm<PokemonCardConfig>> => {
  const strings = await loadTranslations("random", "editor", editorLanguage());

  return {
    schema: [
      appearanceField(strings),
      {
        type: "grid",
        name: "",
        schema: PARTS.map((part) => ({
          name: `show_${part}`,
          default: true,
          selector: { boolean: {} },
        })),
      },
    ],
    computeLabel: fieldText(strings),
    assertConfig: (config) => assertAppearance(config, strings),
  };
};
