# HISTORY.md — katgpt-web

History, resolved-issue records, incident narratives. Removed issue files
live in git history (workspace noise rule).

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
  `VITE_BASE=/katgpt-web/ npm run build` + `npx gh-pages -d dist`
  (the README-documented manual path) → Pages serves the `gh-pages`
  branch; pushes to `main` carry `[skip ci]` so `deploy.yml` does not
  burn minutes (the workflow file is untouched and stays the promoted
  path for later).
- Drift row `002-branch-divergence` removed from `BOUNDARY.md` in the
  same change; issue file removed (this entry is the record).

## 2026-09-09 — Issue 001 (removed, git history): C0e dangling routing cells

Two dangling `../<retired-repo>` routing cells in `BOUNDARY.md` → fixed
in `fed7544` on the (then) working branch; landed on `main` via the
Issue 002 merge `c0f7dc4`.
