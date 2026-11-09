import type { HacCard } from "@home-assistant/components/card/scoped";

/** Options every card supports. */
export interface BaseCardConfig {
  type: string;
  appearance?: HacCard["appearance"];
}

/**
 * The implementation of a card: a Lit element inside the lazy card, created
 * when the card is first added to the page. It follows the lazy card's
 * connects and disconnects on its own, as a child of its shadow root.
 */
export interface CardController<C> {
  setConfig(config: C): void;
}

export interface LazyCardDefinition<C extends BaseCardConfig> {
  /** Tag name, without `custom:`. */
  type: string;
  /** Shown in the card picker. */
  name: string;
  description: string;
  /** Starting config in the card picker, without the `type`. */
  stubConfig: Omit<C, "type">;
  cardSize: number;
  /** Dynamic import of the module with the implementation. */
  card: () => Promise<{ createCard: (host: HTMLElement, config?: C) => CardController<C> }>;
  /** Dynamic import of the module with the visual editor. */
  editor: () => Promise<{ createConfigForm: () => Promise<object> }>;
}

/**
 * Registers a card whose code only loads when it is needed.
 *
 * Home Assistant loads every resource on every dashboard, so the entry point
 * only contains this small element per card: what the card picker and Lovelace
 * need synchronously. It doesn't use Lit. The implementation (a Lit element
 * with its styles, Lit itself, the component library, translations) loads when
 * the card is first added to a page, and the editor when it is opened. A
 * dashboard without the card never loads its code.
 */
export const defineLazyCard = <C extends BaseCardConfig>(definition: LazyCardDefinition<C>): void => {
  if (customElements.get(definition.type)) {
    return;
  }

  class LazyCard extends HTMLElement {
    static getStubConfig(): Omit<C, "type"> {
      return { ...definition.stubConfig };
    }

    static async getConfigForm(): Promise<object> {
      const { createConfigForm } = await definition.editor();
      return createConfigForm();
    }

    #config?: C;
    #card?: CardController<C>;
    #loading = false;

    setConfig(config: C): void {
      if (!config) {
        throw new Error("Invalid configuration");
      }
      this.#config = config;
      this.#card?.setConfig(config);
    }

    getCardSize(): number {
      return definition.cardSize;
    }

    connectedCallback(): void {
      if (!this.#card) {
        void this.#load();
      }
    }

    async #load(): Promise<void> {
      if (this.#loading) {
        return;
      }
      this.#loading = true;
      try {
        const { createCard } = await definition.card();
        // The config is set before the element connects, where it starts loading.
        this.#card = createCard(this, this.#config);
      } catch (err) {
        // Most likely the chunk could not be fetched; the next connect retries.
        console.error(`[${definition.type}] Failed to load the card`, err);
      } finally {
        this.#loading = false;
      }
    }
  }

  customElements.define(definition.type, LazyCard);

  window.customCards ??= [];
  window.customCards.push({
    type: definition.type,
    name: definition.name,
    description: definition.description,
    preview: true,
  });
};
