# Issue 002 — the first real Pages deploy would publish STALE main: the working branch carries 16 commits main never got, including a duplicate `.heal/` gitignore

**Status:** OPEN — filed 2026-09-09 (idle hygiene pass, detection-only; found via the branch-topology check); disposition `owner-call` (BOUNDARY drift row added same commit)

## The finding

`AGENTS.md §Branch` declares **`main` the working branch** ("no `develop`
exists") and `deploy.yml` publishes Pages from **pushes to `main`**. The
measured state contradicts the declaration:

| Ref | State |
|---|---|
| `feat/percepta-arch-diagrams` (HEAD) | 16 commits of modern work: BOUNDARY.md contract, AGENTS.md, the sudoku-core/sudoku-wasm workspace restructure, Issue 001 C0e fix, `.heal/` gitignore |
| `main` | stale at the fork point + ONE extra commit (`eea3488`) that duplicates the branch's `.heal/` gitignore (`98a8cc4`) with different wording — a classic two-checkout double-landing |
| remote | **NONE — this checkout has never had an origin** (reflog: zero origin traces; README documents GitHub-Pages setup as future intent, step 1 = "Create the GitHub repo") |

Today the divergence is harmless (no remote → no push → no deploy). The
hazard is the first REAL deploy: per the README runbook the owner creates
the GitHub repo and pushes `main` — which ships the **stale site** (no
sudoku-core refactor, no boundary contract, no percepta-arch-diagrams
work), silently. "Every landing commit is a deploy" (AGENTS.md) is exactly
backwards here: the deploy would skip every landing commit the branch holds.

## Why detection-only

The branch carries in-flight feature work ("percepta arch diagrams", last
touched 2026-09-09 02:10) owned by another lane — merging it is not this
session's call. The no-remote state is the README-documented pre-deploy
lifecycle stage; creating a public GitHub repo is the owner's action
(account, name, visibility).

## The fix (when the owner / branch lane picks it up)

1. Merge `main` into the branch (absorbs the duplicate `eea3488`; the two
   `.heal/` hunks agree in intent — expect a trivial same-region conflict,
   keep either wording) — OR, if the branch's work is complete, merge the
   branch to `main` so the working-branch declaration becomes true again.
2. Create the remote + push `main` **after** the merge — the first Pages
   deploy then publishes the real site.
3. Optionally: a CI or guard note that `main` must never sit behind the
   working branch while `deploy.yml` triggers on it (the katgpt-rs
   branch-convention lesson, workspace-local flavor).

## Related

- `.issues/001` (removed, git history): C0e dangling routing cells — fixed
  in `fed7544` on the BRANCH; main does not have that fix either (same
  stale-main hazard).
- `BOUNDARY.md` drift ledger: row `002-branch-divergence` (this issue).
