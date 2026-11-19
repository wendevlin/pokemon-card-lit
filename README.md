# pokemon-card-lit

Two Home Assistant cards, a random Pokémon (`custom:pokemon-card`) and one you can evolve (`custom:pokemon-evolution-card`), built with [Lit](https://lit.dev) on `<hac-card>` from `@home-assistant/components`.

Same cards, same card types and config as [pokemon-card](../pokemon-card), which uses plain custom elements. Install only one of the two: both register the same card types.

## Installation

### Marketplace

1. In the Marketplace, select **Add from link** and enter `https://github.com/wendevlin/pokemon-card-lit`.
2. Download **Pokémon Card (Lit)** and reload the browser.

Every release has two assets:

- `pokemon-card-lit.zip` (`zip_release` in `hacs.json`): the Marketplace unpacks it into one folder. `pokemon-card-lit.js` at the root is the dashboard resource, the chunks it loads are in `chunks/`. A card's code only loads when a dashboard shows it.
- `pokemon-card-lit.js`: the legacy build, the same cards in one file, for Marketplace and Home Assistant versions that can't install a zip. It loads everything up front.

Both install as `pokemon-card-lit.js`, so the dashboard resource is the same either way. A GitHub Action builds, tests and attaches both whenever a release is published.

### Manual

Unpack `pokemon-card-lit.zip` from a release (or copy `dist/` after `bun run build`) to `config/www/pokemon-card-lit/`, keeping the folders, and add `/local/pokemon-card-lit/pokemon-card-lit.js` as a dashboard resource of type JavaScript module.

Or copy only the legacy `pokemon-card-lit.js` from a release (or `dist-legacy/`) to the same place: one file, same resource.

## Development

```sh
bun install
bun run dev           # build to dist/ and rebuild on change
bun run build         # production build to dist/, legacy build to dist-legacy/
bun run package       # production builds, packed into release/
bun run test:release  # pack release/ and test both assets in Chrome
bun run check         # TypeScript
bun run lint          # Biome
```

The build mirrors `src/` in `dist/`:

```
dist/
├── pokemon-card-lit.js                     # entry point, registers the cards
└── chunks/
    ├── index-<hash>.js                     # shared: Lit, <hac-card>, PokéAPI, …
    ├── cards/
    │   ├── random/card-<hash>.js           # loaded when a card is shown
    │   ├── random/editor-<hash>.js         # loaded when its editor opens
    │   └── evolution/…
    └── translations/
        └── de-evolution-card-<hash>.js     # one per language, card and part
```

Chunks load relative to the entry point, so deploy all of `dist/` with its folders.

The legacy build in `dist-legacy/` is the same entry point without code splitting: `pokemon-card-lit.js` with every card, editor and translation inlined (about 36 kB instead of 3 kB up front).

`bun run package` puts both release assets in `release/`: `pokemon-card-lit.zip` (all of `dist/`) and `pokemon-card-lit.js` (from `dist-legacy/`).

`test:release` installs each asset (the zip unpacked, the legacy file on its own), serves it under `/hacsfiles/pokemon-card-lit/` like the Marketplace, and in headless Chrome mounts both cards in German (with a faked language context and a mocked PokéAPI) and opens both editors. Any missing chunk or error fails it, and so does the legacy file loading anything besides itself. It needs Google Chrome installed.

## @home-assistant/components

The component library lives in [`packages/components`](https://github.com/home-assistant/frontend/tree/dev/packages/components) of the frontend repository and is not on npm yet. Until it is, a build of it is vendored as a tarball in `vendor/`, so `bun install` needs no frontend checkout. The version names the frontend commit it was built from, like `0.0.0-git.ccdac789fd`.

To update it:

```sh
bun run update-components          # latest commit on dev
bun run update-components <ref>    # a branch, tag or commit SHA
```

The script fetches only `packages/components` at that ref, builds it like the published package (`rslib build && cem analyze`), packs it into `vendor/` and updates `package.json` and `bun.lock`. Commit all three.

Once the package is published, depend on its npm version and delete `vendor/` and `scripts/update-components.ts`.
