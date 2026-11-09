import { html, nothing, type TemplateResult } from "lit";
import { BaseCard } from "../../lib/base-card";
import { loadTranslations, type Strings } from "../../lib/localize";
import { mountCard } from "../../lib/mount-card";
import { fetchPokemon, type Pokemon, randomPokemonId } from "../../lib/pokeapi";
import { isShown, type Part, type PokemonCardConfig } from "./config";

const TAG_NAME = "pokemon-card-content";

class RandomPokemonCard extends BaseCard<PokemonCardConfig, Strings<"random", "card">, Pokemon> {
  // One Pokémon per card instance; a language change reloads its texts.
  private readonly _id = randomPokemonId();

  protected loadStrings(language: string): Promise<Strings<"random", "card">> {
    return loadTranslations("random", "card", language);
  }

  protected load(signal: AbortSignal, language: string): Promise<Pokemon> {
    return fetchPokemon(this._id, language, signal);
  }

  protected renderContent(): TemplateResult {
    const pokemon = this.data;
    const show = (part: Part): boolean => isShown(this.config, part);
    const hasText = show("name") || show("description");

    // Placeholders keep the layout of the loaded card while it loads.
    return html`
      <div class="pokemon" aria-busy=${String(!pokemon)}>
        ${
          !show("image")
            ? nothing
            : pokemon
              ? html`<img src=${pokemon.image} alt=${pokemon.name} width="96" height="96" />`
              : html`<div class="image-placeholder"></div>`
        }
        ${
          hasText
            ? html`
              <div class="text">
                ${
                  !show("name")
                    ? nothing
                    : pokemon
                      ? html`<h2>${pokemon.name}</h2>`
                      : html`<div class="line-placeholder"></div>`
                }
                ${
                  !show("description")
                    ? nothing
                    : pokemon
                      ? html`<p>${pokemon.description}</p>`
                      : html`<div class="line-placeholder long"></div>`
                }
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: RandomPokemonCard;
  }
}

export const createCard = (host: HTMLElement, config?: PokemonCardConfig): RandomPokemonCard =>
  mountCard(host, TAG_NAME, RandomPokemonCard, config) as RandomPokemonCard;
