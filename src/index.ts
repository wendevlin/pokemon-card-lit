import { defineEvolutionCard } from "./cards/evolution";
import { definePokemonCard } from "./cards/random";

// The entry point only registers the cards. Their implementations, editors and
// translations are separate chunks, loaded when a dashboard or editor needs them.
definePokemonCard();
defineEvolutionCard();

console.info(
  `%c POKEMON-CARD %c ${__CARD_VERSION__} `,
  "color: white; background: #cc0000; font-weight: 700;",
  "color: #cc0000; background: white; font-weight: 700;",
);
