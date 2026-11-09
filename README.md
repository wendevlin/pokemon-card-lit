# pokemon-card-lit

Two Home Assistant cards, a random Pokémon (`custom:pokemon-card`) and one you can evolve (`custom:pokemon-evolution-card`), built with [Lit](https://lit.dev) on `<hac-card>` from `@home-assistant/components`.

Same cards, same card types and config as [pokemon-card](../pokemon-card), which uses plain custom elements. Install only one of the two: both register the same card types.

## Installation

### Marketplace

1. In the Marketplace, select **Add from link** and enter `https://github.com/wendevlin/pokemon-card-lit`.
2. Download **Pokémon Card (Lit)** and reload the browser.

Every release has one asset, `pokemon-card-lit.zip` (`zip_release` in `hacs.json`). The Marketplace unpacks it into one folder: `pokemon-card-lit.js` at the root is the dashboard resource, the chunks it loads are in `chunks/`. A GitHub Action builds, tests and attaches the zip whenever a release is published.

> Installing plugins from a zip needs a Marketplace version that supports `zip_release` for dashboard plugins.

### Manual

Unpack `pokemon-card-lit.zip` from a release (or copy `dist/` after `bun run build`) to `config/www/pokemon-card-lit/`, keeping the folders, and add `/local/pokemon-card-lit/pokemon-card-lit.js` as a dashboard resource of type JavaScript module.

## Development

```sh
bun install
bun run dev           # build to dist/ and rebuild on change
bun run build         # production build
bun run package       # production build, packed into pokemon-card-lit.zip
bun run test:release  # pack the zip and test it in Chrome
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

`test:release` unpacks the zip, serves it under `/hacsfiles/pokemon-card-lit/` like the Marketplace, and in headless Chrome mounts both cards in German (with a faked language context and a mocked PokéAPI) and opens both editors. Any missing chunk or error fails it. It needs Google Chrome installed.

## @home-assistant/components

The component library lives in [`packages/components`](https://github.com/home-assistant/frontend/tree/dev/packages/components) of the frontend repository and is not on npm yet. Until it is, a build of it is vendored as a tarball in `vendor/`, so `bun install` needs no frontend checkout. The version names the frontend commit it was built from, like `0.0.0-git.ccdac789fd`.

To update it:

```sh
bun run update-components          # latest commit on dev
bun run update-components <ref>    # a branch, tag or commit SHA
```

The script fetches only `packages/components` at that ref, builds it like the published package (`rslib build && cem analyze`), packs it into `vendor/` and updates `package.json` and `bun.lock`. Commit all three.

Once the package is published, depend on its npm version and delete `vendor/` and `scripts/update-components.ts`.
