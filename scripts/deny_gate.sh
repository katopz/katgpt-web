#!/bin/sh
# deny_gate.sh — the supply-chain advisories gate (cargo-deny).
#
# Landed as the riir-refine pilot of Batch 294 / Plan 298 / Research 332
# (the wasmtime RUSTSEC-2026-0380 / RUSTSEC-2026-0379 distill). Architecture:
# cargo-deny owns vulnerable CRATES (lockfile surface); the sec corpus owns
# vulnerable USAGE (code-span classes). The clippy analogy, corrected: deny is
# a LOCKFILE oracle feeding (a) this gate and (b) the sec-corpus transcription
# queue (advisory -> class -> rule when the fix is code-shaped) — never a
# span-heal oracle.
#
# Modes:
#   scripts/deny_gate.sh           # gate THIS repo — vulnerability findings exit 1
#   scripts/deny_gate.sh --scan    # survey every workspace repo with a root
#                                  # Cargo.lock — REPORT-ONLY, always exit 0
#   scripts/deny_gate.sh --scan --deep   # + one pass per NESTED lockfile (tools/*,
#                                  # cloudflare/*, wasm/ sub-workspaces) — REPORT-ONLY
#
# A missing cargo-deny is a LOUD SKIP (a deferral, never a green):
#   cargo install cargo-deny --locked
#
# Nested lockfiles (Plan 298 T2.6): excluded sub-workspaces with their own
# Cargo.lock (seal-game-editor tools/*, the cloudflare/ workers, wasm/ builds)
# sit OUTSIDE the root lockfile — plain --scan never sees them. `--scan --deep`
# runs one cargo-deny pass PER nested lockfile, reusing the repo-root
# deny.toml where present (advisory pins are per-advisory-ID and path-free, so
# the same repo's ledger is the right config); no root deny.toml = cargo-deny's
# default config, which may report pinned advisories as findings — read the
# row, never a silent pass. Hidden/ephemeral trees (dot-dirs, target/,
# vendor/, node_modules/) are never walked (find -prune, not -not -path —
# pruning skips the traversal, a huge target/ stays cheap). A stale lockfile
# (manifest moved, lock not updated) makes cargo-deny ERROR, not report
# advisories — such a row prints "ERROR (stale lock?)" and needs
# `cargo update -p <changed>` or a re-lock, never a silent pass.

set -eu
# The guards `-e` demands (katgpt-rs b3db60c4d, the trap_sentinel_gate wall:
# PRECAUTIONARY is one added `-e` away from laundering, so the gate carries
# BOTH defences — errexit AND the completion flag):
#   - `command -v` fails (rc 1) when cargo-deny is absent — the not-installed
#     SKIP LOUD arm must stay a skip, not an abort; guarded with `|| true`.
#   - every CAPTURED cargo-deny run (--scan and --scan --deep) reads a failing
#     run's RUSTSEC ids — `rc=0; out=$(...) || rc=$?` keeps the read alive (a
#     bare `rc=$?` after an -e kill would never run).
#   - the --deep `find` exits non-zero on an unreadable dir; it is a pipeline
#     head (only the `while` tail's status counts — no pipefail), and the
#     `[ ... ] && continue` short-circuit is an AND-list (errexit-exempt).
# Everything else is conditional-context (if/else arms) or sets the flag first.

complete=0  # the completion-sentinel flag (the classifier's LITERAL law: every assignment is a bare literal, never a word)
cleanup() {
    rc=$?
    if [ "$complete" != "1" ] && [ "$rc" = "0" ]; then
        echo "ABORTED: deny_gate did not reach its last line while reporting success —" >&2
        echo "  forcing exit 1 (a premature death must never read as a pass)." >&2
        exit 1
    fi
    exit $rc
}
trap cleanup EXIT

deny_bin=$(command -v cargo-deny 2>/dev/null) || true
if [ -z "$deny_bin" ] && [ -x "$HOME/.cargo/bin/cargo-deny" ]; then
    deny_bin="$HOME/.cargo/bin/cargo-deny"
fi
if [ -z "$deny_bin" ]; then
    echo "SKIP LOUD: cargo-deny not installed — run: cargo install cargo-deny --locked"
    complete=1
    exit 0
fi

mode=gate
if [ "${1:-}" = "--scan" ] || [ "${1:-}" = "--workspace" ]; then
    mode=scan
fi

deep=0
case " $* " in
    *" --deep "*) deep=1 ;;
esac

if [ "$mode" = "gate" ]; then
    if [ ! -f Cargo.lock ]; then
        echo "SKIP LOUD: no Cargo.lock at $(pwd) — nothing to audit"
        complete=1
        exit 0
    fi
    echo "== deny_gate (advisories): $(pwd)"
    if "$deny_bin" check advisories; then
        echo "PASS: no deny-level advisory findings"
        rc_total=0
    else
        echo "FAIL: advisory findings above — adjudicate each (fix/bump, or pin with a reason in deny.toml)"
        rc_total=1
    fi
else
    echo "repo|verdict"
    # Derive the workspace root from THIS script's location (<repo>/scripts/) so
    # the survey runs on any box layout (the pilot's /Users/kat literal broke on
    # /Users/katopz). Siblings of the repo's parent dir = the git farm.
    git_root=$(cd "$(dirname "$0")/.." && pwd)
    farm=$(dirname "$git_root")
    for d in "$farm"/*/; do
        [ -f "${d}Cargo.lock" ] || continue
        name=$(basename "$d")
        rc=0
        out=$(cd "$d" && "$deny_bin" check advisories 2>&1) || rc=$?
        if [ $rc -eq 0 ]; then
            echo "${name}|CLEAN"
        else
            ids=$(printf '%s' "$out" | grep -o "RUSTSEC-[0-9][0-9][0-9][0-9]-[0-9]*" | sort -u | paste -sd, -)
            if [ -n "$ids" ]; then
                echo "${name}|FINDINGS ${ids}"
            else
                echo "${name}|ERROR (stale lock? tool failure — read the output, never a silent pass)"
            fi
        fi
    done
    if [ "$deep" = 1 ]; then
        echo "--- deep pass: nested lockfiles (one cargo-deny per lock; dot-dirs + target/vendor/node_modules pruned) ---"
        for d in "$farm"/*/; do
            name=$(basename "$d")
            # -prune (not -not -path): the traversal itself skips the excluded
            # trees, so a repo with a giant target/ stays cheap.
            find "$d" \( -name target -o -name vendor -o -name node_modules -o -name ".*" \) -prune \
                -o -name Cargo.lock -print 2>/dev/null |
            while IFS= read -r lock; do
                [ "$lock" = "${d}Cargo.lock" ] && continue
                ndir=$(dirname "$lock")
                rel=${lock#"$d"}
                rel="${name}/${rel}"
                if [ ! -f "$ndir/Cargo.toml" ]; then
                    echo "${rel}|SKIP (no manifest beside the lock)"
                    continue
                fi
                # The repo-root ledger rides along: advisory pins are
                # per-advisory-ID and path-free, so the same repo's deny.toml
                # is the right config for its nested workspaces.
                rc=0
                if [ -f "${d}deny.toml" ]; then
                    out=$(cd "$ndir" && "$deny_bin" --config "${d}deny.toml" check advisories 2>&1) || rc=$?
                else
                    out=$(cd "$ndir" && "$deny_bin" check advisories 2>&1) || rc=$?
                fi
                if [ $rc -eq 0 ]; then
                    echo "${rel}|CLEAN"
                else
                    ids=$(printf '%s' "$out" | grep -o "RUSTSEC-[0-9][0-9][0-9][0-9]-[0-9]*" | sort -u | paste -sd, -)
                    if [ -n "$ids" ]; then
                        echo "${rel}|FINDINGS ${ids}"
                    else
                        echo "${rel}|ERROR (stale lock? tool failure — read the output, never a silent pass)"
                    fi
                fi
            done
        done
    fi
    echo "scan complete — FINDINGS rows are survey output, adjudicate each; --scan never fails a run"
    rc_total=0
fi

complete=1  # the last line — the completion sentinel (see cleanup above)
exit $rc_total
