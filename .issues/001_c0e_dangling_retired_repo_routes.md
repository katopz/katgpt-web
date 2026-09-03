# Issue 001 — C0e: two `../<retired-repo>` ROUTING cells dangle (armageddon 09-02, riir-unity 09-04)

**Status:** OPEN — detected by the C0e canary run of
`../riir-ai/scripts/ci_boundary_contract.sh` (2026-09-04, Issue 862's
workspace measurement), filed before the fix per the boundary-guard
issue-before-fix discipline. First .issues entry in this repo — the
numbering machinery starts here at 001. (NOTE: this repo is local-only —
no remote; the working branch `feat/percepta-arch-diagrams` is the de-facto
mainline: `main` predates BOUNDARY.md itself — and the fix lands there.)

## The finding

`../riir-armageddon` (retired 2026-09-02) and `../riir-unity` (retired
2026-09-04) were both retired to `git/obsolete/` by owner act, but this
repo's `BOUNDARY.md` `## Does not own` table still routes to them:

| line | cell | C0e class |
|---|---|---|
| 33 | Game/product UI cell | routing — rot |
| 34 | Editor/engine view layers cell | routing — rot |

## Fix (same session, next commit)

Drop the retired names from both cells (the live homes stay, seal-remake
added); name the retirement once in a lineage note below the table.
Umbrella record: `../riir-ai/.issues/862_boundary_prose_dangling_repo_refs.md`.
