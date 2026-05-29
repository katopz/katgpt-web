/* tslint:disable */
/* eslint-disable */

/**
 * Pure solve — no event emission — returning the step count. The active hull
 * (None / Mono / CHT) is maintained, so timing this call reflects the real
 * solve + attention-cache cost. Used by the web layer for the time chart.
 */
export function count_steps(puzzle: string, mode: string): number;

/**
 * Solve a puzzle and return the full trace + stats as JSON.
 *
 * `puzzle`: 81-char board ('0'/'.' = empty), or `"arto"` / `""` shortcuts.
 * `mode`: engine id — `"brute"` | `"fc"` | `"port"` | `"opt"`.
 * `max_events`: cap on emitted events (the trace can be long; stats stay exact).
 */
export function solve(puzzle: string, mode: string, max_events: number): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly count_steps: (a: number, b: number, c: number, d: number) => number;
    readonly solve: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
