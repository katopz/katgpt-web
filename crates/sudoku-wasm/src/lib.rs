//! WebAssembly bindings over [`sudoku_core`].
//!
//! All solver logic — the backtracking search, the forward-checking and MRV
//! strategies, and both hull caches (the faithful Percepta CHT port and the
//! monotonic optimize hull) — lives in `sudoku-core`, which is plain Rust and
//! unit-tested on the host. This crate only re-exports two functions across
//! the wasm boundary.

use wasm_bindgen::prelude::*;

/// Solve a puzzle and return the full trace + stats + solution as JSON.
///
/// `puzzle`: 81-char board ('0'/'.' = empty), or `"arto"` / `""` shortcuts.
/// `mode`: engine id — `"brute"` | `"fc"` | `"port"` | `"opt"`.
/// `max_events`: cap on emitted trace events (stats stay exact past the cap).
#[wasm_bindgen]
pub fn solve(puzzle: &str, mode: &str, max_events: usize) -> String {
    sudoku_core::solve(puzzle, mode, max_events)
}

/// Pure solve — no trace emitted — returning the step count, for timing.
#[wasm_bindgen]
pub fn count_steps(puzzle: &str, mode: &str) -> usize {
    sudoku_core::count_steps(puzzle, mode)
}
