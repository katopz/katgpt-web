//! Sudoku hull-backtracking solver → WASM.
//!
//! A faithful port of the self-contained, pure-Rust solver in
//! `katgpt-rs/src/percepta/legacy.rs` (`Vec2`, `KVCache2D`, `Sudoku9x9`,
//! `SolveEvent`, `StreamingSolver`). This is the exact engine the
//! `sudoku_04_percepta_vs` example runs — a backtracking solver whose
//! execution trace is recorded into a 2D convex-hull KV cache (Percepta-style
//! O(log N) attention). No rng, no threads, no clock — deterministic and
//! wasm-friendly.
//!
//! The single `solve()` entry point returns the full event stream as JSON; the
//! web layer renders it three ways (9×9 backtracking, Speculative draft/prune,
//! Percepta hull stats) from the same real trace.

use wasm_bindgen::prelude::*;

// ── 2D geometry for the hull cache ──────────────────────────────
#[derive(Clone, Copy)]
struct Vec2 {
    x: f32,
    y: f32,
}

impl Vec2 {
    fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
    /// Z-component of cross product AB × AC.
    #[inline]
    fn cross_z(a: &Self, b: &Self, c: &Self) -> f32 {
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    }
}

/// Upper convex hull of the (step, filled) execution trace — the Percepta
/// "skyline". Maintained in amortized O(1) via Graham scan on append.
struct Hull {
    keys: Vec<Vec2>,
    upper: Vec<usize>,
}

impl Hull {
    fn new() -> Self {
        Self {
            keys: Vec::new(),
            upper: Vec::new(),
        }
    }
    fn len(&self) -> usize {
        self.keys.len()
    }
    fn hull_len(&self) -> usize {
        self.upper.len()
    }
    fn append(&mut self, key: Vec2) {
        let idx = self.keys.len();
        self.keys.push(key);
        while self.upper.len() >= 2 {
            let n = self.upper.len();
            let a = self.keys[self.upper[n - 2]];
            let b = self.keys[self.upper[n - 1]];
            // Right turn (cross < 0) preserves convexity; remove otherwise.
            if Vec2::cross_z(&a, &b, &key) >= 0.0 {
                self.upper.pop();
            } else {
                break;
            }
        }
        self.upper.push(idx);
    }
}

// ── The board + rules engine ────────────────────────────────────
struct Board {
    g: [[u8; 9]; 9],
}

impl Board {
    /// The Percepta `manifest.yaml` reference puzzle (30 clues).
    fn percepta_reference() -> Self {
        Self {
            g: [
                [5, 3, 0, 0, 7, 0, 0, 0, 0],
                [6, 0, 0, 1, 9, 5, 0, 0, 0],
                [0, 9, 8, 0, 0, 0, 0, 6, 0],
                [8, 0, 0, 0, 6, 0, 0, 0, 3],
                [4, 0, 0, 8, 0, 3, 0, 0, 1],
                [7, 0, 0, 0, 2, 0, 0, 0, 6],
                [0, 6, 0, 0, 0, 0, 2, 8, 0],
                [0, 0, 0, 4, 1, 9, 0, 0, 5],
                [0, 0, 0, 0, 8, 0, 0, 7, 9],
            ],
        }
    }

    /// Arto Inkala's "World's Hardest Sudoku" (21 clues).
    fn arto_inkala() -> Self {
        Self {
            g: [
                [8, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 3, 6, 0, 0, 0, 0, 0],
                [0, 7, 0, 0, 9, 0, 2, 0, 0],
                [0, 5, 0, 0, 0, 7, 0, 0, 0],
                [0, 0, 0, 0, 4, 5, 7, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 3, 0],
                [0, 0, 1, 0, 0, 0, 0, 6, 8],
                [0, 0, 8, 5, 0, 0, 0, 1, 0],
                [0, 9, 0, 0, 0, 0, 4, 0, 0],
            ],
        }
    }

    /// Parse an 81-char string ('0' or '.' = empty). Falls back to the
    /// Percepta reference puzzle on any malformed input.
    fn parse(s: &str) -> Self {
        let chars: Vec<char> = s.chars().filter(|c| !c.is_whitespace()).collect();
        if chars.len() != 81 {
            return Self::percepta_reference();
        }
        let mut g = [[0u8; 9]; 9];
        for (i, ch) in chars.iter().enumerate() {
            g[i / 9][i % 9] = match ch {
                '1'..='9' => *ch as u8 - b'0',
                _ => 0,
            };
        }
        Self { g }
    }

    /// The rules engine: does placing `digit` at (row, col) keep the board legal?
    fn is_valid(&self, row: usize, col: usize, digit: u8) -> bool {
        if digit == 0 {
            return false;
        }
        for c in 0..9 {
            if self.g[row][c] == digit {
                return false;
            }
        }
        for r in 0..9 {
            if self.g[r][col] == digit {
                return false;
            }
        }
        let box_r = (row / 3) * 3;
        let box_c = (col / 3) * 3;
        for r in 0..3 {
            for c in 0..3 {
                if self.g[box_r + r][box_c + c] == digit {
                    return false;
                }
            }
        }
        true
    }

    fn clue_count(&self) -> usize {
        self.g.iter().flatten().filter(|&&v| v > 0).count()
    }

    fn next_empty(&self) -> Option<(usize, usize)> {
        for r in 0..9 {
            for c in 0..9 {
                if self.g[r][c] == 0 {
                    return Some((r, c));
                }
            }
        }
        None
    }

    fn to_string81(&self) -> String {
        let mut s = String::with_capacity(81);
        for r in 0..9 {
            for c in 0..9 {
                s.push((b'0' + self.g[r][c]) as char);
            }
        }
        s
    }
}

// ── Streaming solver — emits a Try/Accept/Contra/Backtrack/Solved trace ──
// Event kinds: 0=Try 1=Accept 2=Contradiction 3=Backtrack 4=Solved
struct Solver {
    board: Board,
    hull: Hull,
    steps: usize,
    events: String, // pre-serialized JSON array body
    n_events: usize,
    max_events: usize,
    capped: bool,
}

impl Solver {
    fn new(board: Board, max_events: usize) -> Self {
        Self {
            board,
            hull: Hull::new(),
            steps: 0,
            events: String::new(),
            n_events: 0,
            max_events,
            capped: false,
        }
    }

    fn push(&mut self, ev: &str) {
        if self.n_events >= self.max_events {
            self.capped = true;
            return;
        }
        if self.n_events > 0 {
            self.events.push(',');
        }
        self.events.push_str(ev);
        self.n_events += 1;
    }

    fn solve(&mut self, depth: usize) -> bool {
        let filled = self.board.clue_count();
        self.hull
            .append(Vec2::new(self.steps as f32, filled as f32));
        self.steps += 1;

        let Some((row, col)) = self.board.next_empty() else {
            self.push(r#"{"k":4}"#);
            return true;
        };

        for digit in 1..=9u8 {
            self.push(&format!(
                r#"{{"k":0,"r":{row},"c":{col},"d":{digit},"p":{depth}}}"#
            ));
            if self.board.is_valid(row, col, digit) {
                self.board.g[row][col] = digit;
                let f = self.board.clue_count();
                self.push(&format!(
                    r#"{{"k":1,"r":{row},"c":{col},"d":{digit},"f":{f}}}"#
                ));
                if self.solve(depth + 1) {
                    return true;
                }
                self.board.g[row][col] = 0;
                self.push(&format!(r#"{{"k":3,"r":{row},"c":{col},"p":{depth}}}"#));
            } else {
                self.push(&format!(
                    r#"{{"k":2,"r":{row},"c":{col},"d":{digit},"p":{depth}}}"#
                ));
            }
        }
        false
    }
}

/// Solve a puzzle and return the full trace + stats as JSON.
///
/// `puzzle`: 81-char board ('0'/'.' = empty), or `"arto"` / `""` shortcuts.
/// `max_events`: cap on emitted events (the trace can be long; stats stay exact).
#[wasm_bindgen]
pub fn solve(puzzle: &str, max_events: usize) -> String {
    let board = match puzzle.trim() {
        "" | "percepta" | "reference" => Board::percepta_reference(),
        "arto" | "hardest" => Board::arto_inkala(),
        s => Board::parse(s),
    };
    let puzzle_str = board.to_string81();
    let clues = board.clue_count();
    let cap = if max_events == 0 { 8000 } else { max_events };

    let mut solver = Solver::new(board, cap);
    let solved = solver.solve(0);

    format!(
        r#"{{"solved":{solved},"steps":{steps},"hull":{hull},"trace":{trace},"clues":{clues},"capped":{capped},"puzzle":"{puzzle_str}","events":[{events}]}}"#,
        solved = solved,
        steps = solver.steps,
        hull = solver.hull.hull_len(),
        trace = solver.hull.len(),
        clues = clues,
        capped = solver.capped,
        puzzle_str = puzzle_str,
        events = solver.events,
    )
}
