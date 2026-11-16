# 0001. Stack and hosting

STE-style, relaxed level. No STE dictionary was checked.

**Status:** decided (owner, 2026-11-15)

## Question

Which stack builds the calculator, and where does the page live?

## Options

1. TypeScript, `esbuild`, and one small build script. The output is one HTML file.
2. Vite with a single-file plugin. The output is the same, but the plugin adds about 15 packages.
3. Plain ES modules with no bundler. A browser refuses module scripts from `file://`, so the page needs a server.

For hosting, the options were one file on disk only, or the same file on GitHub Pages also.

## Decision

The project uses option 1, and the owner chose GitHub Pages in addition to the file on disk.

- The language is TypeScript on Node 24, with npm and the Node test runner. This agrees with the owner's
  other TypeScript projects.
- The development packages are `typescript`, `@types/node` and `esbuild`. The page ships with no package.
- `npm run build` writes `dist/index.html`. The script and the styles are inside that file.
- `npm run check` is the one gate. It runs the Node guard, `tsc` three times, the tests, the build and the smoke test.
- `tsc` runs on three configs. `tsconfig.core.json` checks `src/core` with no DOM library and no Node types, so the
  core stays pure. `tsconfig.ui.json` checks `src/ui` with the DOM library. `tsconfig.json` checks the core, the
  scripts and the tests with the Node types.
- The project has no linter, because ESLint adds many packages. Strict `tsc` is the only static check.
- The project is exempt from the yasdd-framework rules and the yas-factory rules (owner, 2026-11-15).

## Reasons

- One file opens from disk without a server and without a network. The same file goes to a static host.
- Fewer packages decrease the supply-chain risk and the install time.
- The core is pure TypeScript, so the Node test runner tests it without a browser package.

## Constraints found

- The `node` on the PATH of the owner's machine is 22.22.1. It does not run `.ts` files. Node 24.21.0 is in
  `~/.nvm`. `scripts/check-node.mjs` stops the check with a clear message on an older Node.
- The build script must escape `</script>` in the bundle. It must replace text with a function, because
  `String.replace` expands `$&` in a replacement string.
- The smoke test uses headless Chrome. These flags gave the correct DOM for a `file://` page with a fragment
  on Chrome 157 (2026-11-15): `--headless=new --disable-gpu --no-first-run --user-data-dir=<dir>
  --virtual-time-budget=2000 --dump-dom <url>`. The smoke test reads `CHROME_BIN` first, then it looks for
  `google-chrome`, `google-chrome-stable`, `chromium` and `chromium-browser` on the PATH.
- Chrome prints an empty DOM, with exit status 0, if the page opens a dialog such as `alert()`. Thus each
  smoke check first makes sure that the page rendered. Without that check, an XSS fault passed one check.
- Headless Chrome has a smallest window width of 500 px. `--window-size=390,...` gives a 500 px layout that
  is cut to 390 px. A phone-width check needs a 390 px `iframe` around the page.
- npm 11 did not run the `esbuild` install script, because the script is not in `allowScripts`. The build
  works without it, because the `esbuild` binary comes from the optional package `@esbuild/linux-x64`.
  Other platforms are unverified.
- The Pages workflow pins each action to a commit hash. The hashes came from the GitHub API on 2026-11-15:
  - `actions/checkout` v7.0.1: `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `actions/setup-node` v7.1.0: `949feb2413d6458794dcd2491c4babbbce0c15c1`
  - `actions/configure-pages` v6.0.0: `45bfe0192ca1faeb007ade9deae92b16b8254a0d`
  - `actions/upload-pages-artifact` v5.0.0: `fc324d3547104276b827a68afc52ff2a11cc49c9`
  - `actions/deploy-pages` v5.0.1: `368f82528645a54fb793d4d04e342629a3f51346`
- GitHub Pages on a private repository needs a paid plan. A public repository is free.
- Unverified: the Pages workflow did not run, because the owner did not push yet. Also unverified: that the
  `ubuntu-latest` runner has Chrome on the PATH for the smoke test. If it does not, set `CHROME_BIN` in the
  workflow, or add a step that installs Chrome.

## Revisit if

- `esbuild` is not available, or its install script becomes a problem.
- The page needs a second file, for example a web worker that cannot be inline.
- The code becomes large, and a linter becomes worth its packages.
