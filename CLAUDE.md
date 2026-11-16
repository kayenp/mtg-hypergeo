# mtg-hypergeo

A one-page calculator for Magic: The Gathering. It gives the exact chance of an opening hand that meets a goal
of several card groups, with the London mulligan, and the chance by turn.

## Stack
TypeScript on Node 24 (Node runs the `.ts` files directly), the Node test runner, `esbuild` for the bundle.
Development packages: `typescript`, `@types/node`, `esbuild`. The page ships with no package.

## Commands
- `npm run check`: the gate. Node guard, `tsc` on three configs, tests, build, smoke test (headless Chrome).
- `npm run build`: writes `dist/index.html`, one file that works from disk.
- Node 24: run `nvm use` (`.nvmrc`), or put `~/.nvm/versions/node/v24.21.0/bin` first on the PATH.
- The smoke test reads `CHROME_BIN` first, then looks for Chrome on the PATH.

## Hard rules
- `src/core` stays pure: no DOM, no Node API, no I/O. `tsconfig.core.json` enforces this.
- No user or link data goes through `innerHTML`. Use `textContent` and `createElement`.
- A share-link format change needs a version bump and a "Changes" entry in `docs/interface.md`.
- No new package without the owner's yes.
- Tests first: see each test fail on an assertion before the code makes it pass.
- The owner made this project exempt from the yasdd-framework and yas-factory rules on 2026-11-15.

## Where to read more
- `docs/spec.md`: what the page does, requirements R1-R21, open questions.
- `docs/interface.md`: the share-link format, version 1.
- `docs/decisions/0001-stack-and-hosting.md`: stack, build, hosting, smoke-test and Chrome facts.
- `docs/decisions/0002-mulligan-model.md`: the keep rule, the clamp, the by-turn identity, model limits.
