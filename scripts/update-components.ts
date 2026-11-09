/**
 * Vendors @home-assistant/components from the Home Assistant frontend repository.
 *
 * The package lives in `packages/components` of home-assistant/frontend but is
 * not published to npm yet. This script builds it the way it will be published
 * (rslib + custom elements manifest) and packs it into `vendor/`, so
 * `bun install` works without a frontend checkout:
 *
 * ```sh
 * bun run update-components          # latest commit on dev
 * bun run update-components <ref>    # a branch, tag or commit SHA
 * ```
 *
 * Commit the new tarball together with package.json and bun.lock. Once the
 * package is on npm, replace the `file:` dependency with a version and delete
 * `vendor/` and this script.
 */
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $ } from "bun";

const REPO = "https://github.com/home-assistant/frontend.git";
const PACKAGE_DIR = "packages/components";
const NAME = "@home-assistant/components";
const root = resolve(import.meta.dir, "..");
const vendor = join(root, "vendor");

const ref = process.argv[2] ?? "dev";
const work = await mkdtemp(join(tmpdir(), "hac-components-"));

try {
  // Only the package directory, without history.
  console.info(`Fetching ${PACKAGE_DIR} at ${ref}…`);
  await $`git init --quiet ${work}`;
  await $`git -C ${work} remote add origin ${REPO}`;
  await $`git -C ${work} sparse-checkout set ${PACKAGE_DIR}`.quiet();
  await $`git -C ${work} fetch --quiet --depth 1 --filter=blob:none origin ${ref}`;
  await $`git -C ${work} checkout --quiet FETCH_HEAD`;
  const sha = (await $`git -C ${work} rev-parse --short=10 HEAD`.text()).trim();

  const pkgDir = join(work, PACKAGE_DIR);
  const pkgFile = Bun.file(join(pkgDir, "package.json"));
  const pkg = await pkgFile.json();
  if (pkg.name !== NAME) {
    throw new Error(`${PACKAGE_DIR} contains ${pkg.name}, expected ${NAME}`);
  }
  // A unique version per commit, so bun.lock and the tarball name show which one is vendored.
  pkg.version = `${pkg.version}-git.${sha}`;
  await Bun.write(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

  console.info(`Building ${NAME}@${pkg.version}…`);
  await $`bun install --no-save`.cwd(pkgDir).quiet();
  await $`bun run build`.cwd(pkgDir);

  // Replace the previous tarball.
  await rm(vendor, { recursive: true, force: true });
  await $`bun pm pack --destination ${vendor} --quiet`.cwd(pkgDir);
  const [tarball] = (await readdir(vendor)).filter((file) => file.endsWith(".tgz"));
  if (!tarball) {
    throw new Error("bun pm pack did not create a tarball");
  }

  const ownFile = Bun.file(join(root, "package.json"));
  const own = await ownFile.json();
  own.dependencies[NAME] = `file:./vendor/${tarball}`;
  await Bun.write(ownFile, `${JSON.stringify(own, null, 2)}\n`);
  await $`bun install`.cwd(root);

  console.info(`\nVendored ${NAME} from home-assistant/frontend@${sha} as vendor/${tarball}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
