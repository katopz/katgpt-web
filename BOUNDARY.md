# katgpt-web — boundary contract

> The single source of truth for what may live in and depend on this repo.
> Audited by the `boundary-guard` skill + `../riir-ai/scripts/ci_boundary_contract.sh`.
> Cross-repo rules LINK to their one canonical home — never copied.
>
> Drift ledger — Disposition: `fixable` | `owner-call` | `by-design`.
> `fixable`/`owner-call` rows REQUIRE an open issue (row ⟺ open issue); a
> `by-design` row cites the decision record instead.
>
> **Filed 2026-08-21 by check C0b** — a workspace-family repo with no contract.
> Written from the repo's own README; the owner should refine the wording.

## Owns

**The public explainer site** — "The Anatomy of KatGPT-RS", an interactive
single-page walkthrough (React + Vite) of the public `katgpt-rs` primitives,
plus the self-contained `crates/sudoku-core` + `crates/sudoku-wasm` demo whose
built artifact is committed under `src/wasm/sudoku/` so the site builds without
a Rust toolchain.

**Domain test:** is this *explaining or demonstrating* the public primitives to
a reader in a browser? NO → it belongs in another repo; file there. This repo is
a **presentation surface**, and it faces the public — it must stay clear of the
private stack entirely.

## Does not own

| Concern | Correct home |
|---|---|
| The primitives themselves | `../katgpt-rs` (public) |
| Anything private (game runtime, chain, storage, training) | the private repos — and it must never appear here at all |
| Game/product UI | `../riir-mmorpg-examples`, `../seal-remake` |
| Editor/engine view layers | `../riir-viewbridge`, `../seal-remake` (`crates/seal-view`) |

Retired lineage (narrative, off the routing cells): `riir-armageddon`
(2026-09-02) and `riir-unity` (2026-09-04) — both under `git/obsolete/`.

## May depend on

| Crate | Location | Condition |
|---|---|---|
| — | — | **Nothing workspace-internal today** (measured 2026-08-21: the only path dep is the in-repo `sudoku-core`). A dep on `../katgpt-rs/crates/katgpt-core` would be admissible — it is the public crate — but **no private repo may ever be depended on here**: this is a public-facing site, and Research 003's public/private axis is the binding rule. |

## Inherited boundaries (links)

- Public/private axis (what may be published at all): `../katgpt-rs/.research/003_Commercial_Open_Source_Strategy_Verdict.md`
- Dep-direction matrix: `../riir-ai/BOUNDARY.md`

## Drift ledger (target vs actual)

None. (Clean at the 2026-08-21 contract-guard run — zero cross-repo edges.)
