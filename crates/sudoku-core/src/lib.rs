//! Pure Sudoku backtracking solver with pluggable search strategies and two
//! interchangeable 2D hull-attention caches. Zero dependencies — no rng, no
//! threads, no clock — so it compiles and runs anywhere, including wasm32.
//!
//! The solver records its execution trace `(step, filled)` into a hull cache,
//! the way Percepta's transformer-vm records tokens into its HullKVCache. Two
//! hull implementations are provided, mapping to the two "Percepta" engines:
//!
//! - [`ChtHead`] — the **port**: a faithful dynamic Convex Hull Trick, ported
//!   from Percepta's `hull2d_cht.h` (Apache-2.0 © Percepta). Handles arbitrary
//!   2D points; O(log h) set-maintained insert.
//! - [`MonotonicHull`] — the **optimize**: a Graham-scan upper hull that
//!   exploits the monotonic-X execution trace for amortized O(1) append.
//!
//! Engines (see [`parse_mode`]):
//! - `brute` — plain row-major backtracking, no hull (the "9×9" engine).
//! - `fc`    — forward-checking: abandon a branch when any cell hits 0 candidates.
//! - `port`  — plain backtracking + [`ChtHead`] (faithful Percepta attention).
//! - `opt`   — most-constrained-variable ordering + [`MonotonicHull`].

// ── 2D geometry for the monotonic hull ──────────────────────────
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

/// **Optimize** hull: upper convex hull of the monotonic-X `(step, filled)`
/// trace, maintained in amortized O(1) via Graham scan on append.
struct MonotonicHull {
    keys: Vec<Vec2>,
    upper: Vec<usize>,
}

impl MonotonicHull {
    fn new() -> Self {
        Self {
            keys: Vec::new(),
            upper: Vec::new(),
        }
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

// ── Faithful Percepta attention: dynamic Convex Hull Trick ──────
// Port of .raw/transformer-vm/attention/hull2d_cht.h (HardAttentionHead +
// dynamic CHT LineContainer). Handles arbitrary 2D points, at the cost of
// O(log h) set maintenance per insert.
#[derive(Clone, Copy)]
struct Line {
    m: f64,
    b: f64,
    p: f64, // breakpoint: last x where this line is best
}

#[derive(Default)]
struct Cht {
    lines: Vec<Line>,
}

impl Cht {
    fn len(&self) -> usize {
        self.lines.len()
    }

    #[inline]
    fn intersect(a: &Line, b: &Line) -> f64 {
        if a.m == b.m {
            if a.b >= b.b {
                f64::INFINITY
            } else {
                f64::NEG_INFINITY
            }
        } else {
            (b.b - a.b) / (a.m - b.m)
        }
    }

    // Faithful port of CHT::add_line — maintain the max envelope.
    fn add_line(&mut self, m: f64, b: f64) {
        let nl = Line { m, b, p: f64::NEG_INFINITY };
        let pos = self.lines.partition_point(|l| l.m < m);
        if pos < self.lines.len() && self.lines[pos].m == m {
            if self.lines[pos].b >= b {
                return;
            }
            self.lines.remove(pos);
        } else if pos > 0 && self.lines[pos - 1].m == m {
            if self.lines[pos - 1].b >= b {
                return;
            }
            self.lines.remove(pos - 1);
        }
        let pos = self.lines.partition_point(|l| l.m < m);
        self.lines.insert(pos, nl);

        // Remove dominated interior lines.
        let mut i = 1;
        while i + 1 < self.lines.len() {
            let pl = Self::intersect(&self.lines[i - 1], &self.lines[i]);
            let pr = Self::intersect(&self.lines[i], &self.lines[i + 1]);
            if pl >= pr {
                self.lines.remove(i);
                if i > 1 {
                    i -= 1;
                }
            } else {
                i += 1;
            }
        }
        // Recompute breakpoints for binary-search queries.
        for j in 0..self.lines.len().saturating_sub(1) {
            self.lines[j].p = Self::intersect(&self.lines[j], &self.lines[j + 1]);
        }
        if let Some(last) = self.lines.last_mut() {
            last.p = f64::INFINITY;
        }
    }
}

/// **Port** hull: HardAttentionHead — dual CHT envelopes for argmax over an
/// arbitrary query direction, faithful to Percepta's `hull2d_cht.h`.
#[derive(Default)]
struct ChtHead {
    upper: Cht,
    lower: Cht,
}

impl ChtHead {
    fn insert(&mut self, kx: f64, ky: f64) {
        self.upper.add_line(kx, ky);
        self.lower.add_line(-kx, -ky);
    }
    fn size(&self) -> usize {
        self.upper.len() + self.lower.len()
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

    /// How many digits 1–9 are legal at (row, col) — the cell's candidate count.
    fn cand_count(&self, row: usize, col: usize) -> u8 {
        (1..=9u8).filter(|&d| self.is_valid(row, col, d)).count() as u8
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

// ── Search strategy ─────────────────────────────────────────────
//   Brute — row-major cell order, try 1–9 (plain backtracking).
//   Fc    — Brute + forward-checking: abandon a branch when any empty cell
//           has zero candidates.
//   Mrv   — most-constrained-variable: expand the empty cell with the fewest
//           candidates first (drastically smaller search tree).
#[derive(Clone, Copy, PartialEq)]
enum Search {
    Brute,
    Fc,
    Mrv,
}

// ── Hull/KV-cache recorded per execution step ───────────────────
//   None — no hull (just solve).
//   Mono — MonotonicHull (Graham scan), the optimize cache.
//   Cht  — ChtHead, the faithful Percepta port.
#[derive(Clone, Copy, PartialEq)]
enum HullKind {
    None,
    Mono,
    Cht,
}

/// Map an engine id to (search strategy, hull kind).
pub fn parse_mode(s: &str) -> (&'static str, &'static str) {
    let (search, hull) = resolve(s);
    (
        match search {
            Search::Brute => "brute",
            Search::Fc => "forward-checking",
            Search::Mrv => "most-constrained",
        },
        match hull {
            HullKind::None => "none",
            HullKind::Mono => "monotonic",
            HullKind::Cht => "cht",
        },
    )
}

fn resolve(s: &str) -> (Search, HullKind) {
    match s {
        "fc" | "spec" | "speculative" => (Search::Fc, HullKind::None),
        "mrv" => (Search::Mrv, HullKind::None),
        // Percepta (port): faithful — plain backtracking + the real CHT attention.
        "port" | "percepta_port" | "percepta" => (Search::Brute, HullKind::Cht),
        // Percepta (optimize): MRV ordering + the monotonic hull.
        "opt" | "percepta_opt" | "optimize" => (Search::Mrv, HullKind::Mono),
        _ => (Search::Brute, HullKind::None),
    }
}

// ── Streaming solver — emits a Try/Accept/Contra/Backtrack/Solved trace ──
// Event kinds: 0=Try 1=Accept 2=Contradiction 3=Backtrack 4=Solved
struct Solver {
    board: Board,
    mono: MonotonicHull,
    cht: ChtHead,
    steps: usize,
    search: Search,
    hk: HullKind,
    quiet: bool, // when true, skip event emission (pure timing / step count)
    events: String,
    n_events: usize,
    max_events: usize,
    capped: bool,
}

impl Solver {
    fn new(board: Board, max_events: usize, search: Search, hk: HullKind, quiet: bool) -> Self {
        Self {
            board,
            mono: MonotonicHull::new(),
            cht: ChtHead::default(),
            steps: 0,
            search,
            hk,
            quiet,
            events: String::new(),
            n_events: 0,
            max_events,
            capped: false,
        }
    }

    /// Size of the active hull/envelope (compression target).
    fn hull_size(&self) -> usize {
        match self.hk {
            HullKind::Cht => self.cht.size(),
            _ => self.mono.hull_len(),
        }
    }

    fn push(&mut self, ev: &str) {
        if self.quiet || self.n_events >= self.max_events {
            self.capped = self.capped || (!self.quiet && self.n_events >= self.max_events);
            return;
        }
        if self.n_events > 0 {
            self.events.push(',');
        }
        self.events.push_str(ev);
        self.n_events += 1;
    }

    /// Choose the next empty cell per the active strategy.
    fn pick_cell(&self) -> Option<(usize, usize)> {
        if self.search == Search::Mrv {
            let mut best: Option<(usize, usize)> = None;
            let mut best_n = 10u8;
            for r in 0..9 {
                for c in 0..9 {
                    if self.board.g[r][c] == 0 {
                        let n = self.board.cand_count(r, c);
                        if n < best_n {
                            best_n = n;
                            best = Some((r, c));
                            if n <= 1 {
                                return best;
                            }
                        }
                    }
                }
            }
            best
        } else {
            self.board.next_empty()
        }
    }

    /// Forward-check: is any empty cell already a dead end (zero candidates)?
    fn dead_end(&self) -> bool {
        for r in 0..9 {
            for c in 0..9 {
                if self.board.g[r][c] == 0 && self.board.cand_count(r, c) == 0 {
                    return true;
                }
            }
        }
        false
    }

    fn solve(&mut self, depth: usize) -> bool {
        let filled = self.board.clue_count();
        // Record the (step, filled) execution-trace point into the active hull.
        match self.hk {
            HullKind::None => {}
            HullKind::Mono => self.mono.append(Vec2::new(self.steps as f32, filled as f32)),
            HullKind::Cht => self.cht.insert(self.steps as f64, filled as f64),
        }
        self.steps += 1;

        let Some((row, col)) = self.pick_cell() else {
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
                let dead = self.search == Search::Fc && self.dead_end();
                if !dead && self.solve(depth + 1) {
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

fn board_for(puzzle: &str) -> Board {
    match puzzle.trim() {
        "" | "percepta" | "reference" => Board::percepta_reference(),
        "arto" | "hardest" => Board::arto_inkala(),
        s => Board::parse(s),
    }
}

/// Solve a puzzle and return the full trace + stats + solution as JSON.
///
/// `puzzle`: 81-char board ('0'/'.' = empty), or `"arto"` / `""` shortcuts.
/// `mode`: engine id — `"brute"` | `"fc"` | `"port"` | `"opt"`.
/// `max_events`: cap on emitted events (the trace can be long; stats stay exact).
pub fn solve(puzzle: &str, mode: &str, max_events: usize) -> String {
    let board = board_for(puzzle);
    let puzzle_str = board.to_string81();
    let clues = board.clue_count();
    let cap = if max_events == 0 { 8000 } else { max_events };
    let (search, hk) = resolve(mode);

    let mut solver = Solver::new(board, cap, search, hk, false);
    let solved = solver.solve(0);
    let hull = solver.hull_size();
    let trace = solver.steps;
    // The recursion runs to completion (only event emission is capped), so the
    // board now holds the full solution — return it for the final frame.
    let answer = solver.board.to_string81();

    format!(
        r#"{{"solved":{solved},"steps":{steps},"hull":{hull},"trace":{trace},"clues":{clues},"capped":{capped},"puzzle":"{puzzle_str}","answer":"{answer}","events":[{events}]}}"#,
        solved = solved,
        steps = solver.steps,
        hull = hull,
        trace = trace,
        clues = clues,
        capped = solver.capped,
        puzzle_str = puzzle_str,
        answer = answer,
        events = solver.events,
    )
}

/// Pure solve — no event emission — returning the step count. The active hull
/// is maintained, so timing this call reflects the real solve + cache cost.
pub fn count_steps(puzzle: &str, mode: &str) -> usize {
    let (search, hk) = resolve(mode);
    let mut solver = Solver::new(board_for(puzzle), 0, search, hk, true);
    solver.solve(0);
    solver.steps
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_json_num(json: &str, key: &str) -> i64 {
        let pat = format!("\"{key}\":");
        let start = json.find(&pat).unwrap() + pat.len();
        let rest = &json[start..];
        let end = rest.find([',', '}']).unwrap();
        rest[..end].trim().parse().unwrap()
    }

    fn answer_of(json: &str) -> String {
        let pat = "\"answer\":\"";
        let start = json.find(pat).unwrap() + pat.len();
        let rest = &json[start..];
        rest[..rest.find('"').unwrap()].to_string()
    }

    fn is_valid_solution(a: &str) -> bool {
        if a.len() != 81 || a.contains('0') {
            return false;
        }
        let g: Vec<u8> = a.bytes().map(|b| b - b'0').collect();
        for i in 0..9 {
            let mut row = [false; 10];
            let mut col = [false; 10];
            let mut bx = [false; 10];
            for j in 0..9 {
                let r = g[i * 9 + j] as usize;
                let c = g[j * 9 + i] as usize;
                let br = (i / 3) * 3 + j / 3;
                let bc = (i % 3) * 3 + j % 3;
                let b = g[br * 9 + bc] as usize;
                if row[r] || col[c] || bx[b] {
                    return false;
                }
                row[r] = true;
                col[c] = true;
                bx[b] = true;
            }
        }
        true
    }

    #[test]
    fn all_engines_solve_reference() {
        for mode in ["brute", "fc", "port", "opt"] {
            let json = solve("percepta", mode, 8000);
            assert!(json.contains("\"solved\":true"), "{mode} should solve");
            assert!(is_valid_solution(&answer_of(&json)), "{mode} answer invalid");
        }
    }

    #[test]
    fn all_engines_solve_arto() {
        for mode in ["brute", "fc", "port", "opt"] {
            let json = solve("arto", mode, 8000);
            assert!(json.contains("\"solved\":true"), "{mode} should solve arto");
            assert!(is_valid_solution(&answer_of(&json)), "{mode} arto answer invalid");
        }
    }

    #[test]
    fn smart_engines_take_fewer_steps() {
        let brute = count_steps("arto", "brute");
        let fc = count_steps("arto", "fc");
        let opt = count_steps("arto", "opt");
        assert!(fc < brute, "forward-checking should prune (fc {fc} < brute {brute})");
        assert!(opt < brute, "mrv should prune (opt {opt} < brute {brute})");
    }

    #[test]
    fn port_records_cht_hull() {
        // port uses the CHT head; its hull size should be reported (> 0).
        let json = solve("percepta", "port", 100);
        assert!(parse_json_num(&json, "hull") > 0);
    }
}
