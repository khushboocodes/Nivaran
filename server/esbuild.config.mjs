/**
 * Bundles the API server into a single JavaScript file for production boot.
 *
 * Why this exists instead of just running `tsc`:
 *
 * `tsconfig.json` uses `moduleResolution: "Bundler"`, which lets the source
 * write extensionless relative imports (`./routes/auth`). TypeScript emits
 * those verbatim, and Node's ESM loader requires full specifiers — so
 * `node dist/.../index.js` died with ERR_MODULE_NOT_FOUND. The compiled
 * output was unrunnable, and the container fell back to running the
 * TypeScript sources through `tsx` at every boot. That put a full transpile
 * of the import graph on the critical path of every cold start, which on a
 * free instance that spins down after 15 minutes idle is a cost paid by
 * whoever opens the link next.
 *
 * esbuild resolves those specifiers and the `@nivaran/shared` path alias at
 * build time, so the runtime does no transpiling and no module resolution
 * beyond the external dependencies.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));

/**
 * Runtime dependencies stay external. They are already present in the image's
 * `node_modules`, and several cannot survive bundling: `argon2` loads a
 * native `.node` binary, `@prisma/client` resolves generated code and a query
 * engine relative to its own package directory, and `pdfkit` reads font files
 * off disk. Leaving them as plain imports keeps those lookups intact and
 * keeps the bundle small.
 *
 * `@nivaran/shared` is deliberately absent from this list. It is a workspace
 * package published as raw TypeScript with no build step of its own, so it
 * has to be inlined — Node could never load it directly.
 */
const external = Object.keys(pkg.dependencies ?? {});

await esbuild.build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  // Keep readable names: this is a server bundle, so download size is
  // irrelevant and legible stack traces are worth more than bytes.
  minify: false,
  logLevel: 'info',
  external,
  // Mirrors the `paths` entry in tsconfig.json. Without it the bare
  // specifier would resolve through node_modules to TypeScript source,
  // which works by accident locally and not at all in a slim image.
  alias: {
    '@nivaran/shared': path.join(here, '../shared/src/index.ts'),
  },
});
