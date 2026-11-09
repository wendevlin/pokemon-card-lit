import { hacCard } from "@home-assistant/components/card/scoped";
import { ScopedElementsMixin } from "@home-assistant/components/scoped";
import { ContextConsumer, createContext } from "@lit/context";
import { type CSSResultGroup, css, html, LitElement, type nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import type { BaseCardConfig, CardController } from "./lazy-card";
import type { CommonStrings } from "./localize";

/** Subset of the `hassInternationalization` context of the frontend. */
interface HassInternationalization {
  language: string;
  locale?: { language: string };
}

// The frontend creates its context with the same key, so the keys match.
const i18nContext = createContext<HassInternationalization>("hassInternationalization");

/**
 * Shared implementation of the cards: a <hac-card> in a scoped shadow root,
 * the user's language, translations, and loading data for that language.
 *
 * Subclasses implement `loadStrings` and `load` (fetch the translations and
 * the data) and `renderContent` (show them inside the card). Errors show the
 * shared, translated error message.
 */
export abstract class BaseCard<C extends BaseCardConfig, S extends CommonStrings<"card">, D>
  extends ScopedElementsMixin(LitElement, [hacCard])
  implements CardController<C>
{
  /** Lovelace always calls `setConfig` before the card is added to the page. */
  @state() protected config = { type: "" } as C;

  /** Result of the last successful `load`. */
  @state() protected data?: D;

  /** Translations for the current language, once loaded. */
  @state() protected strings?: S;

  /** Whether a `load` is running. */
  @state() protected loading = false;

  @state() private _error = false;

  private _language = "en";

  private _abort?: AbortController;

  constructor() {
    super();
    // Home Assistant answers synchronously when the card connects, before the
    // first load in `connectedCallback`, and again on every change.
    new ContextConsumer(this, {
      context: i18nContext,
      subscribe: true,
      callback: (i18n) => {
        const language = i18n.locale?.language ?? i18n.language;
        if (language !== this._language) {
          this._language = language;
          // Only reload for later changes, once a load has started.
          if (this._abort) {
            void this.reload();
          }
        }
      },
    });
  }

  /** Loads the translations for `language`. Never fails, it falls back to English. */
  protected abstract loadStrings(language: string): Promise<S>;

  /** Fetches the data to show. `signal` aborts when a newer load starts or the card is removed. */
  protected abstract load(signal: AbortSignal, language: string): Promise<D>;

  /** Renders the current state inside the card. */
  protected abstract renderContent(): TemplateResult | typeof nothing;

  /** Called after the config changed; `previous` is undefined the first time. */
  protected configChanged(_previous: C | undefined): void {}

  setConfig(config: C): void {
    const previous = this.config.type ? this.config : undefined;
    this.config = config;
    this.configChanged(previous);
  }

  connectedCallback(): void {
    // Requests the language first, see the constructor.
    super.connectedCallback();
    void this.reload();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._abort?.abort();
    this._abort = undefined;
  }

  /** Loads the translations and the data for the current language. */
  protected async reload(): Promise<void> {
    this._abort?.abort();
    const abort = new AbortController();
    this._abort = abort;
    const language = this._language;
    this.loading = true;

    // In parallel. Translations fall back to English, so they only fail if
    // even English can't be fetched.
    const [strings, data] = await Promise.allSettled([
      this.loadStrings(language),
      this.load(abort.signal, language),
    ]);
    // A newer load, or removing the card, aborted this one while it finished.
    // Checked first, so a slow old load can't replace newer strings or data.
    if (abort.signal.aborted) {
      return;
    }
    if (strings.status === "fulfilled") {
      this.strings = strings.value;
    } else {
      console.warn(`[${this.localName}] Failed to load the translations`, strings.reason);
    }
    this._error = data.status === "rejected";
    if (data.status === "fulfilled") {
      this.data = data.value;
    } else {
      console.warn(`[${this.localName}] Failed to load`, data.reason);
    }
    this.loading = false;
  }

  protected render(): TemplateResult {
    return html`
      <hac-card appearance=${this.config.appearance ?? "outlined"}>
        ${
          this._error && this.strings
            ? html`<p class="error">${this.strings.load_error}</p>`
            : this.renderContent()
        }
      </hac-card>
    `;
  }

  static styles: CSSResultGroup = css`
    :host {
      display: block;
      /* A hint of Lit blue (#324fff), to tell these cards apart from the plain ones. */
      --hac-card-background: color-mix(
        in srgb,
        #324fff 10%,
        var(--ha-card-background, var(--card-background-color, var(--ha-color-surface-default, #fff)))
      );
    }

    .pokemon {
      display: flex;
      align-items: center;
      gap: var(--ha-space-4, 16px);
    }

    img,
    .image-placeholder {
      flex: none;
      width: 96px;
      height: 96px;
    }

    img {
      object-fit: contain;
    }

    .text {
      flex: 1;
      min-width: 0;
    }

    h2 {
      margin: 0 0 var(--ha-space-1, 4px);
      font-size: var(--ha-font-size-l, 1rem);
      font-weight: var(--ha-font-weight-medium, 500);
    }

    p {
      margin: 0;
      color: var(--secondary-text-color);
    }

    .image-placeholder,
    .line-placeholder {
      border-radius: var(--ha-border-radius-md, 8px);
      background: var(--ha-color-fill-neutral-quiet-resting, #ebebeb);
    }

    .line-placeholder {
      width: 40%;
      height: 1em;
      margin-block: var(--ha-space-1, 4px);
    }

    .line-placeholder.long {
      width: 90%;
    }

    .error {
      color: var(--error-color);
    }
  `;
}
