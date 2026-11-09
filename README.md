# pokemon-card-lit

Two Home Assistant cards, a random Pokémon (`custom:pokemon-card`) and one you can evolve (`custom:pokemon-evolution-card`), built with [Lit](https://lit.dev) on `<hac-card>` from `@home-assistant/components`.

Same cards, same card types and config as [pokemon-card](../pokemon-card), which uses plain custom elements. Install only one of the two: both register the same card types.

## Installation

### Marketplace

1. In the Marketplace, open the menu → **Custom repositories**, add `https://github.com/wendevlin/pokemon-card-lit` with the type **Dashboard**.
2. Download **Pokémon Card (Lit)** and reload the browser.

The Marketplace installs the assets of the latest release: `pokemon-card-lit.js` and the chunks it loads. A GitHub Action builds and attaches them whenever a release is published.

### Manual

Copy all files of `dist/` (from `bun run build` or a release) to `config/www/pokemon-card-lit/` and add `/local/pokemon-card-lit/pokemon-card-lit.js` as a dashboard resource of type JavaScript module.

## Development

```sh
bun install
bun run dev      # build to dist/ and rebuild on change
bun run build    # production build
bun run check    # TypeScript
bun run lint     # Biome
```

Deploy all of `dist/` and add `dist/pokemon-card-lit.js` as a dashboard resource: cards, editors and translations are chunks loaded next to it.

## @home-assistant/components

The component library lives in [`packages/components`](https://github.com/home-assistant/frontend/tree/dev/packages/components) of the frontend repository and is not on npm yet. Until it is, a build of it is vendored as a tarball in `vendor/`, so `bun install` needs no frontend checkout. The version names the frontend commit it was built from, like `0.0.0-git.ccdac789fd`.

To update it:

```sh
bun run update-components          # latest commit on dev
bun run update-components <ref>    # a branch, tag or commit SHA
```

The script fetches only `packages/components` at that ref, builds it like the published package (`rslib build && cem analyze`), packs it into `vendor/` and updates `package.json` and `bun.lock`. Commit all three.

Once the package is published, depend on its npm version and delete `vendor/` and `scripts/update-components.ts`.
