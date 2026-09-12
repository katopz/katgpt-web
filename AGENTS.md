# AGENTS.md — katgpt-web

The global `~/.agents/` rules apply; this file documents repo-local context.

## Boundary contract — read `BOUNDARY.md` first

[`BOUNDARY.md`](BOUNDARY.md) is the authoritative per-repo contract: what this
repo **owns**, what it **does not own** (with the correct home for each), the
crate-granular **allowlist** of what it may depend on, links to the cross-repo
rules' one canonical home, and the **drift ledger** of known gaps. On any
conflict with prose in this file, BOUNDARY.md wins.

- **Domain test:** is this **explaining or demonstrating the public primitives** to a reader in a browser? NO → it belongs in another repo; file there.
- **Read it before** adding any dep, crate, page, or component — and before assuming a concern is yours to implement.
- **Enforcement** is not prose: `../riir-ai/scripts/ci_boundary_contract.sh` fails on an undeclared cross-repo dep, on a drift row without its open issue, and on a contract row that no longer matches the measured graph. Run boundary checks VIA the `boundary-guard` skill, not as ad-hoc greps.
- **Found a violation?** File the issue FIRST (`.issues/NNN_boundary_*.md`), add the drift row, then fix. Closing the issue removes the row in the same commit.

## Role

**The public explainer site** — "The Anatomy of KatGPT-RS", an interactive
single-page walkthrough (React + Vite) of the public `katgpt-rs` primitives,
structured after Roy van Rijn's "Anatomy of an LLM". The final chapter ("Watch
It Solve") runs the **real Rust Sudoku solver compiled to WebAssembly**, live in
the browser — `crates/sudoku-core` + `crates/sudoku-wasm`, with the built
artifact committed under `src/wasm/sudoku/` so the site builds without a Rust
toolchain.

**Public-facing, private-free (non-negotiable).** This repo faces the public —
per `katgpt-rs` Research 003's public/private axis, no private `riir-*` repo
may ever be depended on (or named) here. Content explains the public
`../katgpt-rs/crates/katgpt-core` primitives only. A dep on `katgpt-core` is
admissible; everything else workspace-internal is not.

## Repo Layout

| Path | Role |
|---|---|
| `src/` | React app (`App.jsx`, `components/`, committed `wasm/sudoku/` artifact) |
| `crates/sudoku-core` | Self-contained Rust Sudoku solver (in-repo, no workspace deps) |
| `crates/sudoku-wasm` | `wasm-pack` wrapper producing the browser artifact |
| `dist/` | Vite build output |
| `.github/workflows/deploy.yml` | Builds WASM + site, publishes GitHub Pages on push to `main` |

## Build Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
npm run build:wasm   # only after editing crates/sudoku-wasm
                     # (wasm-pack → src/wasm/sudoku/, then re-run npm run build)
```

**Committing the WASM artifact:** `src/wasm/sudoku/` is a build OUTPUT that is
deliberately committed (so the site builds without a Rust toolchain). After any
`crates/sudoku-*` change, run `npm run build:wasm` and commit the regenerated
artifact in the same change — the two must never drift.

## Numbering Discipline

Issue, plan, doc, benchmark, and research numbers are **monotonic and never
reused** — even after a file is removed per the noise-reduction rule. Before
creating a new `.issues/` file, read `.issues/.highwater`, use `value + 1` as
the number, and write the new value back. Same for `.plans/`, `.docs/`,
`.benchmarks/`, `.research/`. Create the folders if they do not exist yet
(this repo currently has none of them).

## Branch

`main` is the working branch (no `develop` exists). Note: pushing to `main`
re-publishes the site via the GitHub Pages workflow — every landing commit is a
deploy.

**Guard (Issue 002, 2026-09-09): `main` must never sit behind the working
branch** while `deploy.yml` triggers on it — a push of stale `main` silently
publishes a stale site. Land directly on `main` (or ff it before pushing).
Deploy status: MANUAL for now (owner call 2026-09-09 — Actions free-tier
limit): `VITE_BASE=/katgpt-web/ npm run build` + `npx gh-pages -d dist`,
Pages serving the `gh-pages` branch; pushes to `main` carry `[skip ci]`
until the Actions lane is re-enabled (HISTORY.md).
