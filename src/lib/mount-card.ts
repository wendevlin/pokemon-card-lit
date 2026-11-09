import {
  attachScopedShadow,
  createScopedElement,
  createScopedElementRegistry,
} from "@home-assistant/components/scoped";
import type { BaseCardConfig, CardController } from "./lazy-card";

type CardElement<C> = HTMLElement & CardController<C>;

// One registry per card type, shared by all its instances.
const registries = new Map<string, CustomElementRegistry>();

/**
 * Renders the Lit element of a card in a scoped shadow root of the lazy card
 * (`host`). The element's tag name only exists in that registry, so it can't
 * clash with other cards, unless scoped registries are not supported at all.
 */
export const mountCard = <C extends BaseCardConfig, K extends keyof HTMLElementTagNameMap>(
  host: HTMLElement,
  tagName: K,
  element: new () => HTMLElementTagNameMap[K] & CardElement<C>,
  config: C | undefined,
): CardElement<C> => {
  let registry = registries.get(tagName);
  if (!registry) {
    registry = createScopedElementRegistry([{ tagName, element }]);
    registries.set(tagName, registry);
  }
  const root = attachScopedShadow(host, { mode: "open" }, registry);
  const card = createScopedElement(root, tagName) as HTMLElementTagNameMap[K] & CardElement<C>;
  if (config) {
    card.setConfig(config);
  }
  // Connecting starts loading, so the config is set first.
  root.append(card);
  return card;
};
