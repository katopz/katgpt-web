# Issue 003 — cross-repo citations that name no OWNING repo (1 row)

**Status:** RESOLVED 2026-09-12 — the one row is repaired; this repo's `cross` is **0** and its ceiling in katgpt-rs `scripts/citation_drift_floors.txt` was lowered `1 -> 0` in the same commit (katgpt-rs `5ea1f40a`, Issue 753).

## The finding class

`1` citation in this repo's contract documents names a document number that is **not allocated in this repo**, **is** allocated in one or more sibling repos, and whose surrounding prose names **no repo that OWNS the number**.

The defect is **rebinding, not dangling.** A bare `Research 003` is not merely unresolvable — it is a *relative* address into whichever repo the reader happens to be standing in. It reads correctly today only because this repo has not yet allocated that number. The day it does, the sentence silently starts pointing at a **different, locally-real document** — no link rots, no grep fails, no gate reds. That is the founding example behind katgpt-rs Issue 749; it is why a dangling-link checker cannot find this class.

**The rebinding here is imminent, not theoretical.** This repo's issue highwater is `002` and this very issue is `003`. The number `003` is now live locally in *one* kind and a bare `Research 003` is one `.research/` file away from colliding in its own — the shortest fuse in the workspace.

## The repair

Name the owning repo in the prose:

```
- per Research 003's public/private axis              ← rebinds once this repo allocates 003
+ per katgpt-rs Research 003's public/private axis    ← addresses one document, forever
```

The qualifier must be the **owning** repo's directory name, within the citation's 3-line window (katgpt-rs Issue 752: a repo name only qualifies a citation if that repo actually **owns** the number — naming a non-owner is the MISATTRIBUTED sub-class, and it is worse than naming nothing).

⚠ **This repo's own private-free rule constrains which owner may be named.** `AGENTS.md` two lines above the citation states that no private `riir-*` repo may ever be depended on **or named** here. Research 003 is allocated in seven repos — katgpt-rs, riir-ai, riir-chain, riir-clippy, riir-neuron-db, riir-train, seal-game-editor — of which only **katgpt-rs** is public. So the qualifier is admissible only if the sentence means katgpt-rs's Research 003, which is also the document that defines the public/private axis the sentence invokes. Confirm that before editing; if the sentence meant a private repo's document, the citation cannot be qualified here at all and the prose needs rewording instead.

## ⛔ Read the row before editing it — two UNBLENDED error rates

The pre-Issue-752 corpus (254 rows) carries a **measured 7/43 = 16% false-positive rate** from a stratified manual **sample** (katgpt-rs Issue 751 T1). The 45 rows *recovered* by Issue 752 (the owner-must-own tightening, corpus 254 → 291) carry **0/45** from a full **census** — those are the high-confidence half. The two do not blend, and a sample rate does not transfer to rows it never sampled. With a single row there is no useful expected-FP arithmetic at all: read it.

- A row being listed here is **evidence to look**, not a verdict that the prose is wrong.
- Line numbers are as of the 2026-09-12 sweep run; a concurrent edit moves them. The row was re-read against the live `AGENTS.md` at filing and still matched its captured excerpt — **0 drift**.

## Sub-classes, highest priority first

| priority | sub-class | rows | why |
|---|---|---|---|
| 1 | `⛔MISATTRIBUTED` | 0 | the prose names a repo that **does not own** the number — a plausible address that is wrong, strictly worse than no address |
| 2 | `⛔MISLEADING` | 0 | the only crate name in the window maps to a repo that does not own the number — same failure mode, one indirection out |
| 3 | `crate-hint` | 0 | a crate in the window maps to a real owner — the repair is mechanical, but the reader still cannot perform it |
| 4 | (plain) | 1 | a bare number with no locator at all |

## The row (1 CROSS row)

### `AGENTS.md` — 1 row

| line | kind | № | owner(s) | sub-class | source line |
|---|---|---|---|---|---|
| 29 | Research | 3 | katgpt-rs / riir-ai / riir-chain / riir-clippy / riir-neuron-db / riir-train / seal-game-editor | plain | per Research 003's public/private axis, no private `riir-*` repo may ever be |

`HISTORY.md` contributes 0 CROSS rows.

## What is NOT in this list

- **AMBIGUOUS (2 rows)** — the number exists BOTH locally and in a sibling. Undecidable from the number alone; deliberately not gated (a ceiling would red on every perfectly correct citation to a new local number a sibling happens to share).
- **IN-LOCAL-RANGE (0 rows)** — a number below this repo's own highwater for its kind. This bucket is **UNDECIDED** and is never folded into either neighbour.
- **ORPHAN (0 rows)** — no repo in the workspace owns the number.

Corpus for this repo: **6 citations** across **2 contract documents** (`AGENTS.md`, `HISTORY.md`) — the smallest corpus of the 19 contract repos. A 1-row finding over a 6-citation walk is a **1-in-6 CROSS rate**, the highest in the workspace; read the walk size beside the count, because a ceiling is green only over what the instrument can see.

## Reproduce

```bash
../katgpt-rs/scripts/citation_drift_sweep.py        # all 19 contract repos
../katgpt-rs/scripts/citation_drift_sweep.py .      # this repo only
```

Workspace standing at filing (2026-09-12, a dated SNAPSHOT and not a checksum — five-plus concurrent sessions edit these documents): **291 CROSS · 54 IN-LOCAL-RANGE · 0 ORPHAN · 908 AMBIGUOUS** over 2,948 citations in 35 documents across 19 contract repos; of the 291, 7 are MISATTRIBUTED and 22 MISLEADING. Upstream records: katgpt-rs `.issues/749` (the rebinding class), `.issues/751` (the sweep + its error rate), `.issues/752` (the owner-must-own tightening, 254 → 291, commit `60bc76aa`).

## Tasks

- [ ] T1 — read `AGENTS.md:29`, confirm the sentence means katgpt-rs's Research 003, and qualify it (or reword, if it meant a private repo's document — which this repo may not name)
- [ ] T2 — record the row HERE if judged a sweep false positive, with the reason (that is the data that lowers the 16%)
- [ ] T3 — re-run the sweep; this repo's CROSS count should reach 0 or the reason recorded in T2


## Resolution (2026-09-12)

The ⚠ above is the whole of it: the qualifier is admissible **only** if the
sentence means katgpt-rs's Research 003. Confirmed on evidence, not permission —
katgpt-rs's `.research/003_Commercial_Open_Source_Strategy_Verdict.md` is the
document that *defines the axis this sentence invokes*:

> Let public-research agents self-govern the public/private boundary without
> needing the sensitive moat doc.
>
> The table above is the **public/private** axis.

riir-ai carries a same-titled copy and it **differs** — the private variant,
inadmissible here regardless of which one was meant. So the referent is
katgpt-rs's, the citation is qualified rather than the prose reworded, and this
repo's private-free rule is untouched (katgpt-rs is public, and `AGENTS.md`
already names `../katgpt-rs/crates/katgpt-core` two lines below).

Applied exactly as the repair block above specifies, rewrapped to the file's
80-column convention:

```
- per Research 003's public/private axis, no private `riir-*` repo may ever be
+ per `katgpt-rs` Research 003's public/private axis, no private `riir-*` repo
```

⚠ One ownership row looked like an instrument bug and was not: seal-game-editor
is listed among the seven owners while having **no `.research/` directory**. It
allocated `.research/003_migration_gap_audit.md` and removed it under the
noise-reduction rule; the sweep's `allocated()` walks `git log --all` precisely
so a removed-but-allocated number still counts against a citation. Checked
rather than assumed — the "seven repos" figure above stands.
