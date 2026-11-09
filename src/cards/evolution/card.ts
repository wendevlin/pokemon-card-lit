import { css, html, nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../../lib/base-card";
import { loadTranslations, type Strings } from "../../lib/localize";
import { mountCard } from "../../lib/mount-card";
import {
  type EvolutionNode,
  fetchEvolutionChain,
  fetchPokemon,
  findInChain,
  type Pokemon,
} from "../../lib/pokeapi";
import type { EvolutionCardConfig } from "./config";

const TAG_NAME = "pokemon-evolution-card-content";

interface EvolutionData {
  pokemon: Pokemon;
  /** What the Pokémon can evolve into: none, one, or several (like Eevee). */
  next: EvolutionNode[];
}

/** `null` data: no Pokémon configured. */
class EvolutionCard extends BaseCard<
  EvolutionCardConfig,
  Strings<"evolution", "card">,
  EvolutionData | null
> {
  /** Species ID of the current stage; `undefined` is the configured base Pokémon. */
  @state() private _stage?: number;

  protected configChanged(previous: EvolutionCardConfig | undefined): void {
    if (previous && previous.pokemon !== this.config.pokemon) {
      // Another Pokémon: start over from its base stage.
      this._stage = undefined;
      this.data = undefined;
      if (this.isConnected) {
        void this.reload();
      }
    }
  }

  protected loadStrings(language: string): Promise<Strings<"evolution", "card">> {
    return loadTranslations("evolution", "card", language);
  }

  protected async load(signal: AbortSignal, language: string): Promise<EvolutionData | null> {
    const species = this._stage ?? this.config.pokemon;
    if (!species) {
      return null;
    }
    const pokemon = await fetchPokemon(species, language, signal);
    const chain = await fetchEvolutionChain(pokemon.evolutionChain);
    return { pokemon, next: findInChain(chain, pokemon.id)?.evolvesTo ?? [] };
  }

  private _evolve(): void {
    const next = this.data?.next;
    if (this.loading || !next?.length) {
      return;
    }
    // Branched evolutions, like Eevee's, pick one at random.
    this._stage = next[Math.floor(Math.random() * next.length)]!.id;
    void this.reload();
  }

  protected renderContent(): TemplateResult {
    const { data, strings } = this;
    if (data === null) {
      return html`<p>${strings?.no_pokemon ?? ""}</p>`;
    }

    const pokemon = data?.pokemon;
    const canEvolve = Boolean(data?.next.length);
    // Lit keeps the button between renders, so it keeps its focus.
    return html`
      <div class="pokemon" aria-busy=${String(this.loading)}>
        ${
          pokemon
            ? html`
              <img src=${pokemon.image} alt=${pokemon.name} width="96" height="96" />
              <div class="text"><h2>${pokemon.name}</h2></div>
            `
            : html`
              <div class="image-placeholder"></div>
              <div class="text"><div class="line-placeholder"></div></div>
            `
        }
        ${
          strings && data
            ? html`
              <button type="button" class="evolve" ?disabled=${!canEvolve} @click=${this._evolve}>
                ${canEvolve ? strings.evolve : strings.fully_evolved}
              </button>
            `
            : nothing
        }
      </div>
    `;
  }

  static styles = [
    BaseCard.styles,
    css`
      /* Not disabled while loading: that would drop the focus. Clicks are ignored instead. */
      .evolve {
        flex: none;
        padding: var(--ha-space-2, 8px) var(--ha-space-4, 16px);
        border: none;
        border-radius: var(--ha-border-radius-pill, 9999px);
        background: var(--ha-color-fill-primary-loud-resting, #009ac7);
        color: var(--ha-color-on-primary-loud, #fff);
        font: inherit;
        font-weight: var(--ha-font-weight-medium, 500);
        cursor: pointer;
      }

      .evolve:hover:not(:disabled) {
        background: var(--ha-color-fill-primary-loud-hover, #007ea6);
      }

      .evolve:focus-visible {
        outline: 2px solid var(--ha-color-focus, #009ac7);
        outline-offset: 2px;
      }

      .evolve:disabled {
        background: var(--ha-color-fill-disabled-loud-resting, #c4c4c4);
        cursor: default;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: EvolutionCard;
  }
}

export const createCard = (host: HTMLElement, config?: EvolutionCardConfig): EvolutionCard =>
  mountCard(host, TAG_NAME, EvolutionCard, config) as EvolutionCard;
