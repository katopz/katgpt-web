# HISTORY.md — katgpt-web

History, resolved-issue records, incident narratives. Removed issue files
live in git history (workspace noise rule).

## 2026-09-12 — Issue 003 resolved: the bare katgpt-rs Research 003 citation rebinds locally

The finding (filed by the katgpt-rs Issue 751 cross-repo citation sweep):
one citation in this repo's contract documents named a document number not
allocated locally — bare `Research 003` — while the number is allocated in
seven sibling repos. The defect is REBINDING, not dangling: the day this
repo allocates `.research/003`, the sentence silently points at a
different, locally-real document. And the fuse was the shortest in the
workspace — this very issue file was the repo's first `003`, so a bare
`katgpt-rs Research 003` was one `.research/` file away from colliding in-repo.

Resolution (`f8bfcde`, resolves the issue; `8e9cb8a` filed it): the
citation qualified with the OWNING repo's directory name. The private-free
rule constrained the qualifier — of the seven owners, only katgpt-rs is
public and nameable here, and katgpt-rs Research 003 is also the document
that defines the public/private axis the sentence invokes, so the
qualification is both admissible and correct. This repo's `cross` count is
**0**; the ceiling in katgpt-rs `scripts/citation_drift_floors.txt` was
lowered `1 -> 0` in the same commit (katgpt-rs `5ea1f40a`, Issue 753).

## 2026-09-09 — Issue 002 resolved: stale main absorbed + first real Pages deploy (manual)

The finding: `main` had diverged from the working branch —
`feat/percepta-arch-diagrams` carried 16 commits main never got, `main`
held one duplicate `.heal/` gitignore commit (`eea3488`, a two-checkout
double-landing vs the branch's `98a8cc4`), and the checkout had NO remote,
so the first real push would have published the STALE site via
`deploy.yml` (Pages workflow, triggers on `main`). Filed as
`.issues/002` + BOUNDARY drift row `002-branch-divergence`
(owner-call).

Resolution (owner un-gated 2026-09-09: "do manual deploy for now"):

- Merge `main` INTO the branch absorbed the duplicate — `.gitignore`
  same-region conflict resolved to main's richer wording (the
  riir-clippy Issue 037 cite); `main` fast-forwarded to the merge commit
  `c0f7dc4`, making `main` the working branch again (feat branch
  deleted, fully merged). Guard note added to `AGENTS.md §Branch`:
  main must never sit behind the working branch while the Pages deploy
  triggers on it.
- Remote created: `github.com/katopz/katgpt-web` (public, ssh) — the
  public web surface of the public `katopz/katgpt-rs` funnel.
- Deploy is MANUAL until the Actions budget allows the workflow back:
  `VITE_BASE=/katgpt-web/ npm run build` → Pages serves the `gh-pages`
  branch; pushes to `main` carry `[skip ci]` so `deploy.yml` does not
  burn minutes (the workflow file is untouched and stays the promoted
  path for later). Live: https://katopz.github.io/katgpt-web/
  (Pages build_type `legacy`, source `gh-pages`, HTTPS enforced).
- Deploy-chain lesson (found live, first deploy): the npm `gh-pages`
  tool, creating the branch fresh, CLONES `main` into its cache, cleans
  only NON-dotfiles, and copies `dist/` in — the cloned branch's
  dotfiles (`.github/`, `.gitignore`, `.issues/`) survive into the
  published commit. Working manual chain: temp dir `git init -b
  gh-pages` + `cp -R dist/. .` + `.nojekyll` + force-push the orphan
  branch, then `rm -rf node_modules/.cache/gh-pages` so future tool
  runs clone the clean `gh-pages` branch (its only dotfile is
  `.nojekyll`, which the survivor bug keeps — harmless).
- Drift row `002-branch-divergence` removed from `BOUNDARY.md` in the
  same change; issue file removed (this entry is the record).

## 2026-09-09 — Issue 001 (removed, git history): C0e dangling routing cells

Two dangling `../<retired-repo>` routing cells in `BOUNDARY.md` → fixed
in `fed7544` on the (then) working branch; landed on `main` via the
Issue 002 merge `c0f7dc4`.
