# The Anatomy of KatGPT-RS

> **Boundary contract:** [BOUNDARY.md](BOUNDARY.md) — what lives here, what may depend on it, known drift.

An interactive, single-page walkthrough of [KatGPT-RS](https://github.com/katopz/katgpt-rs) —
a neuro-symbolic micro-Transformer in Rust. Built with **React + Vite**, structured after
Roy van Rijn's [Anatomy of an LLM](https://www.royvanrijn.com/anatomy-of-an-llm/).

The final chapter ("Watch It Solve") runs the **real Rust Sudoku solver compiled to
WebAssembly**, live in the browser — see [`crates/sudoku-wasm`](crates/sudoku-wasm).

## Prerequisites

- **Node.js 18+** and npm
- **Rust + `wasm-pack`** — only needed if you change the WASM crate (the built artifact is
  committed under `src/wasm/sudoku/`, so you can run/build the site without them):

  ```bash
  rustup target add wasm32-unknown-unknown
  cargo install wasm-pack        # or: brew install wasm-pack
  ```

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

## Build & preview

```bash
npm run build        # → dist/
npm run preview      # serve the production build locally
```

### Rebuilding the WebAssembly solver

The site ships a prebuilt WASM module, so this is only required after editing
`crates/sudoku-wasm/src/lib.rs`:

```bash
npm run build:wasm   # wasm-pack → src/wasm/sudoku/, then re-run npm run build
```

## Deploy to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the WASM,
builds the site, and publishes it on every push to `main`.

**One-time setup:**

1. Push this folder to a GitHub repo named **`katgpt-web`**
   (the path the site is served from — see the base-path note below).
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually via **Actions → Deploy to GitHub Pages →
   Run workflow**). The site appears at `https://<user>.github.io/katgpt-web/`.

### Base path

GitHub project pages are served from a sub-path (`/<repo>/`), so [`vite.config.js`](vite.config.js)
sets `base` automatically:

- **local** → `/`
- **GitHub Actions** → `/katgpt-web/`

If your repo (or Pages path) has a different name, override it:

```bash
VITE_BASE=/my-repo/ npm run build
```

or edit the default in `vite.config.js`. For a user/org page (`<user>.github.io`) or a custom
domain, set `VITE_BASE=/`.

### Manual deploy (no Actions)

```bash
VITE_BASE=/katgpt-web/ npm run build
npx gh-pages -d dist        # or push dist/ to a gh-pages branch
```

**Current mode (2026-09-09): deploys ARE the manual path** (owner call —
GitHub Actions free-tier limit). Pages serves the `gh-pages` branch;
until the Actions lane is re-enabled, pushes to `main` carry `[skip ci]`
so `deploy.yml` stays dormant. Guard: `main` must never sit behind the
working branch — the deploy trigger follows `main` (see `AGENTS.md §Branch`).

## Project layout

```
src/
  App.jsx                 # chapters + sticky-nav scroll-spy
  components/
    ui.jsx                # Stat, Card, DataTable, BarChart, …
    widgets.jsx           # interactive demos (DDTree, MoA mixer, Architecture, Percepta VM, Sudoku)
  wasm/sudoku/            # prebuilt wasm-pack output (committed)
  styles.css
Cargo.toml                # Rust workspace (sudoku-core + sudoku-wasm)
crates/
  sudoku-core/            # pure solver: backtracking + forward-checking + MRV,
                          #   CHT (port) and monotonic (optimize) hulls. Native tests.
  sudoku-wasm/            # thin wasm-bindgen bindings over sudoku-core
.github/workflows/deploy.yml
```

Run the core's native tests with `cargo test -p sudoku-core`.
