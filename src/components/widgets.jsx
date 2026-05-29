import { useState, useMemo, useRef, useEffect } from "react";

// ---------- shared shell ----------
function Widget({ title, tag, hint, children }) {
  return (
    <div className="widget">
      <div className="w-head">
        <span className="w-title">{title}</span>
        {tag && <span className="w-tag">{tag}</span>}
        {hint && <span className="w-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const softmax = (logits, t) => {
  const tt = Math.max(t, 1e-3);
  const m = Math.max(...logits);
  const ex = logits.map((l) => Math.exp((l - m) / tt));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
};

// ============================================================
// 1. Tokenizer — char → vocab index (micro model: BOS + a..z)
// ============================================================
export function TokenizerDemo() {
  const [text, setText] = useState("hello world");
  const tokens = useMemo(() => {
    const clean = text.toLowerCase();
    const out = [{ ch: "·", idx: 0, label: "BOS" }];
    for (const c of clean) {
      if (c >= "a" && c <= "z")
        out.push({ ch: c, idx: c.charCodeAt(0) - 96, label: c });
      else if (c === " ") out.push({ ch: "␣", idx: -1, label: "oov" });
      else out.push({ ch: c, idx: -1, label: "oov" });
    }
    return out;
  }, [text]);

  const colors = [
    "#dea584",
    "#f5b942",
    "#5fd38d",
    "#6ea8fe",
    "#b692f6",
    "#f0716f",
  ];
  return (
    <Widget
      title="Tokenizer"
      tag="vocab_size = 27"
      hint="type below — BOS + a–z map to indices 0–26"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="type some text…"
      />
      <div className="tokens">
        {tokens.map((t, i) => (
          <span
            key={i}
            className="tok"
            style={
              t.idx < 0
                ? { borderColor: "#f0716f", color: "#f0716f" }
                : {
                    borderColor: colors[t.idx % colors.length],
                    color: colors[t.idx % colors.length],
                  }
            }
            title={t.idx < 0 ? "out of vocab" : `index ${t.idx}`}
          >
            {t.label}
            <span style={{ color: "var(--faint)", marginLeft: 6 }}>
              {t.idx < 0 ? "—" : t.idx}
            </span>
          </span>
        ))}
      </div>
      <p style={{ fontSize: 13, color: "var(--faint)", marginBottom: 0 }}>
        {tokens.length} tokens · the real BPE tokenizer (
        <code className="inline">Config::bpe()</code>) learns merges for code;
        this micro vocab keeps the reference model tiny.
      </p>
    </Widget>
  );
}

// ============================================================
// 2. Temperature sampler
// ============================================================
export function TemperatureSampler() {
  const [t, setT] = useState(0.5);
  const cands = ["l", "p", "d", "m", "a"];
  const logits = [3.4, 2.1, 1.3, 0.6, 0.1];
  const probs = softmax(logits, t);
  return (
    <Widget
      title="Logits → Sampling"
      tag={`temperature = ${t.toFixed(2)}`}
      hint="after the prompt “hel…”"
    >
      <div className="control-row">
        <label>temperature</label>
        <input
          type="range"
          min="0.05"
          max="2"
          step="0.05"
          value={t}
          onChange={(e) => setT(+e.target.value)}
        />
        <span className="val">{t.toFixed(2)}</span>
      </div>
      {cands.map((c, i) => (
        <div className="probrow" key={c}>
          <span className="lab">{c}</span>
          <span className="track">
            <span className="fill" style={{ width: `${probs[i] * 100}%` }} />
          </span>
          <span className="pct">{(probs[i] * 100).toFixed(1)}%</span>
        </div>
      ))}
      <p style={{ fontSize: 13, color: "var(--faint)", marginBottom: 0 }}>
        Low temperature sharpens toward the argmax (greedy); high temperature
        flattens the distribution. The reference model ships with{" "}
        <code className="inline">temperature = 0.5</code>.
      </p>
    </Widget>
  );
}

// ============================================================
// 3. DDTree — best-first draft tree under a node budget
// ============================================================
export function DDTreeDemo() {
  const [budget, setBudget] = useState(7);
  // a fixed candidate tree; each node has a marginal log-prob (lp)
  const nodes = useMemo(
    () => [
      { id: 0, x: 0.5, y: 0, parent: null, tok: "BOS", lp: 0 },
      { id: 1, x: 0.28, y: 1, parent: 0, tok: "t", lp: -0.4 },
      { id: 2, x: 0.62, y: 1, parent: 0, tok: "a", lp: -0.9 },
      { id: 3, x: 0.84, y: 1, parent: 0, tok: "o", lp: -1.7 },
      { id: 4, x: 0.18, y: 2, parent: 1, tok: "h", lp: -0.7 },
      { id: 5, x: 0.4, y: 2, parent: 1, tok: "e", lp: -1.3 },
      { id: 6, x: 0.6, y: 2, parent: 2, tok: "n", lp: -1.4 },
      { id: 7, x: 0.78, y: 2, parent: 3, tok: "k", lp: -2.5 },
      { id: 8, x: 0.12, y: 3, parent: 4, tok: "e", lp: -1.0 },
      { id: 9, x: 0.3, y: 3, parent: 4, tok: "i", lp: -1.9 },
      { id: 10, x: 0.55, y: 3, parent: 6, tok: "d", lp: -2.0 },
    ],
    [],
  );
  // cumulative score = sum of lp along path
  const score = useMemo(() => {
    const map = {};
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    for (const n of nodes) {
      let s = 0,
        cur = n;
      while (cur) {
        s += cur.lp;
        cur = cur.parent != null ? byId[cur.parent] : null;
      }
      map[n.id] = s;
    }
    return map;
  }, [nodes]);
  // best-first: expand root, then highest-scoring frontier nodes up to budget
  const expanded = useMemo(() => {
    // best-first proxy: always keep root, then highest cumulative-score nodes
    const ranked = [...nodes].sort((a, b) => score[b.id] - score[a.id]);
    const keep = new Set([0]);
    for (const n of ranked) {
      if (keep.size >= budget) break;
      keep.add(n.id);
    }
    return keep;
  }, [nodes, score, budget]);

  const W = 460,
    H = 230,
    pad = 24;
  const px = (x) => pad + x * (W - 2 * pad);
  const py = (y) => pad + (y / 3) * (H - 2 * pad);

  return (
    <Widget
      title="DDTree — Dynamic Draft Tree"
      tag={`budget = ${budget} nodes`}
      hint="best-first expansion by cumulative log-prob"
    >
      <div className="control-row">
        <label>node budget</label>
        <input
          type="range"
          min="1"
          max="11"
          step="1"
          value={budget}
          onChange={(e) => setBudget(+e.target.value)}
        />
        <span className="val">{budget}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {nodes.map((n) =>
          n.parent != null ? (
            <line
              key={`e${n.id}`}
              x1={px(nodes.find((p) => p.id === n.parent).x)}
              y1={py(
                n.parent === null ? 0 : nodes.find((p) => p.id === n.parent).y,
              )}
              x2={px(n.x)}
              y2={py(n.y)}
              stroke={expanded.has(n.id) ? "#dea584" : "#2a2d3a"}
              strokeWidth={expanded.has(n.id) ? 2 : 1}
            />
          ) : null,
        )}
        {nodes.map((n) => {
          const on = expanded.has(n.id);
          return (
            <g key={n.id}>
              <circle
                cx={px(n.x)}
                cy={py(n.y)}
                r={15}
                fill={on ? "#f97316" : "#1f222e"}
                stroke={on ? "#f5b942" : "#2a2d3a"}
                strokeWidth={1.5}
              />
              <text
                x={px(n.x)}
                y={py(n.y) + 4}
                textAnchor="middle"
                fontSize="12"
                fontFamily="ui-monospace, monospace"
                fill={on ? "#14110c" : "#6b7088"}
              >
                {n.tok}
              </text>
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 13, color: "var(--faint)", marginBottom: 0 }}>
        A <code className="inline">BinaryHeap</code> drives Best-First Search:
        the tree spends its budget on the highest cumulative-probability
        branches first. Invalid branches are pruned
        <em> before</em> they ever reach the verifier.
      </p>
    </Widget>
  );
}

// ============================================================
// 4. ScreeningPruner relevance threshold
// ============================================================
export function ScreeningPrunerDemo() {
  const [thr, setThr] = useState(0.4);
  const branches = [
    { tok: "5", r: 0.95 },
    { tok: "3", r: 0.81 },
    { tok: "8", r: 0.62 },
    { tok: "1", r: 0.44 },
    { tok: "9", r: 0.3 },
    { tok: "x", r: 0.12 },
    { tok: "?", r: 0.04 },
  ];
  const kept = branches.filter((b) => b.r >= thr).length;
  return (
    <Widget
      title="ScreeningPruner — graded relevance"
      tag={`R ≥ ${thr.toFixed(2)}`}
      hint="R ∈ [0,1] replaces binary valid/invalid"
    >
      <div className="control-row">
        <label>relevance cutoff</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={thr}
          onChange={(e) => setThr(+e.target.value)}
        />
        <span className="val">{thr.toFixed(2)}</span>
      </div>
      {branches.map((b) => {
        const on = b.r >= thr;
        return (
          <div
            className="probrow"
            key={b.tok}
            style={{ opacity: on ? 1 : 0.35 }}
          >
            <span className="lab">{b.tok}</span>
            <span className="track">
              <span
                className="fill"
                style={{
                  width: `${b.r * 100}%`,
                  background: on ? undefined : "#3a3d4a",
                }}
              />
            </span>
            <span
              className="pct"
              style={{ color: on ? "var(--green)" : "var(--red)" }}
            >
              {on ? "keep" : "prune"}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: 13, color: "var(--faint)", marginBottom: 0 }}>
        <span className="kicker">
          {kept}/{branches.length}
        </span>{" "}
        branches survive. The
        <code className="inline">BanditPruner</code> learns this cutoff online —
        hitting a 100% goal rate where a fixed binary pruner gets 0% at a tight
        budget.
      </p>
    </Widget>
  );
}

// ============================================================
// 5. Speculative accept-length
// ============================================================
export function AcceptLengthDemo() {
  const [gamma, setGamma] = useState(8);
  const [seed, setSeed] = useState(2);
  // deterministic pseudo-accept based on seed + gamma
  const accepted = useMemo(() => {
    let a = 0;
    for (let i = 0; i < gamma; i++) {
      const r = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 7.233)) % 1;
      if (r > 0.18) a++;
      else break;
    }
    return Math.min(a + 1, gamma + 1); // Leviathan: always ≥1, up to γ+1
  }, [gamma, seed]);
  return (
    <Widget
      title="Speculative Verification"
      tag={`γ = ${gamma} draft tokens`}
      hint="LeviathanVerifier — always ≥1 token, up to γ+1"
    >
      <div className="control-row">
        <label>draft length γ</label>
        <input
          type="range"
          min="1"
          max="12"
          step="1"
          value={gamma}
          onChange={(e) => setGamma(+e.target.value)}
        />
        <span className="val">{gamma}</span>
        <button className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          resample
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
        {Array.from({ length: gamma + 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--mono)",
              fontSize: 12,
              background: i < accepted ? "#5fd38d" : "#1f222e",
              color: i < accepted ? "#0c0d12" : "#6b7088",
              border: "1px solid var(--border)",
            }}
          >
            {i < accepted ? "✓" : i === gamma ? "+" : "·"}
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--faint)",
          marginTop: 14,
          marginBottom: 0,
        }}
      >
        <span className="kicker">{accepted} tokens accepted</span> from one
        verifier pass. Residual sampling guarantees the output distribution is
        identical to the target model — the speedup is free. Benchmarks hit{" "}
        <strong>avg accept len 7.0</strong> on the AR draft path.
      </p>
    </Widget>
  );
}

// ============================================================
// 6. Raven RSM — O(1) routing slots
// ============================================================
export function RavenSlotsDemo() {
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(new Set());
  const SLOTS = 16,
    K = 3;
  const step = () => {
    const n = count + 1;
    // top-K routing: hash token -> K slots
    const sel = new Set();
    for (let j = 0; j < K; j++) sel.add((n * 7 + j * 5 + j * j * 3) % SLOTS);
    setActive(sel);
    setCount(n);
  };
  return (
    <Widget
      title="Raven RSM — O(1) routing slot memory"
      tag="16 slots, Top-3"
      hint="KV memory stays constant regardless of sequence length"
    >
      <div className="control-row">
        <button className="btn" onClick={step}>
          process next token
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setCount(0);
            setActive(new Set());
          }}
        >
          reset
        </button>
        <span className="w-hint">
          tokens processed:{" "}
          <span className="val" style={{ minWidth: "auto" }}>
            {count}
          </span>
        </span>
      </div>
      <div className="slots">
        {Array.from({ length: SLOTS }).map((_, i) => (
          <div
            key={i}
            className={`slot ${active.has(i) ? "active" : "frozen"}`}
          >
            {i}
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--faint)",
          marginTop: 14,
          marginBottom: 0,
        }}
      >
        Only the Top-3 routed slots update; the rest are{" "}
        <strong>completely frozen</strong>. After 1000 noisy updates the model
        still retrieves the passkey — at <strong>9.25M tok/s</strong> recall.
        GDN2 generalises this to a constant per-head state for{" "}
        <strong>87–98% memory savings</strong>.
      </p>
    </Widget>
  );
}

// ============================================================
// 8. MoA — Mixture of Activations (token-adaptive FFN)
// ============================================================
const MOA_ACTS = [
  { name: "Id", color: "#9aa0b4", fn: (x) => x },
  { name: "ReLU", color: "#5fd38d", fn: (x) => Math.max(0, x) },
  {
    name: "ReLU²",
    color: "#6ea8fe",
    fn: (x) => {
      const r = Math.max(0, x);
      return r * r;
    },
  },
  { name: "LeakyReLU", color: "#b692f6", fn: (x) => (x >= 0 ? x : 0.01 * x) },
  {
    name: "GELU",
    color: "#f5b942",
    fn: (x) => x * (1 / (1 + Math.exp(-1.702 * x))),
  },
  { name: "SiLU", color: "#dea584", fn: (x) => x * (1 / (1 + Math.exp(-x))) },
  { name: "Tanh", color: "#f0716f", fn: (x) => Math.tanh(x) },
];
const MOA_PRESETS = {
  "SiLU only": [0, 0, 0, 0, 0, 1, 0],
  "ReLU + ReLU²": [0, 0.6, 0.5, 0, 0, 0, 0],
  balanced: [0.2, 0.3, 0.1, 0, 0.3, 0.4, 0.2],
};
export function MoaMixerDemo() {
  const [gates, setGates] = useState(MOA_PRESETS["ReLU + ReLU²"]);
  const W = 460,
    H = 220,
    pad = 26;
  const xs = useMemo(
    () => Array.from({ length: 121 }, (_, i) => -3 + (i * 6) / 120),
    [],
  );
  const mixed = (x) => MOA_ACTS.reduce((s, a, k) => s + gates[k] * a.fn(x), 0);
  const ys = xs.map(mixed);
  const yMin = Math.min(-0.5, ...ys),
    yMax = Math.max(1.5, ...ys);
  const px = (x) => pad + ((x + 3) / 6) * (W - 2 * pad);
  const py = (y) => H - pad - ((y - yMin) / (yMax - yMin)) * (H - 2 * pad);
  const path = (fn) =>
    xs
      .map(
        (x, i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${py(fn(x)).toFixed(1)}`,
      )
      .join(" ");
  const setGate = (k, v) => setGates((g) => g.map((x, i) => (i === k ? v : x)));
  return (
    <Widget
      title="MoA — Mixture of Activations"
      tag="bi-MoA SwiGLU"
      hint="mix the 7-activation dictionary per token: σ_mix(x) = Σ π_k · σ_k(x)"
    >
      <div
        style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}
      >
        {Object.keys(MOA_PRESETS).map((p) => (
          <button
            key={p}
            className="btn ghost"
            onClick={() => setGates(MOA_PRESETS[p])}
          >
            {p}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <line
          x1={pad}
          y1={py(0)}
          x2={W - pad}
          y2={py(0)}
          stroke="#2a2d3a"
          strokeWidth="1"
        />
        <line
          x1={px(0)}
          y1={pad}
          x2={px(0)}
          y2={H - pad}
          stroke="#2a2d3a"
          strokeWidth="1"
        />
        {MOA_ACTS.map((a, k) =>
          gates[k] > 0 ? (
            <path
              key={a.name}
              d={path(a.fn)}
              fill="none"
              stroke={a.color}
              strokeWidth="1"
              opacity="0.25"
            />
          ) : null,
        )}
        <path d={path(mixed)} fill="none" stroke="#f97316" strokeWidth="2.5" />
      </svg>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px 16px",
          marginTop: 10,
        }}
      >
        {MOA_ACTS.map((a, k) => (
          <div className="control-row" key={a.name} style={{ margin: "3px 0" }}>
            <label style={{ minWidth: 76, color: a.color }}>{a.name}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={gates[k]}
              onChange={(e) => setGate(k, +e.target.value)}
            />
            <span className="val" style={{ minWidth: 38 }}>
              {gates[k].toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--faint)",
          marginTop: 6,
          marginBottom: 0,
        }}
      >
        The orange curve is the per-token mixed activation. A real model learns
        gates π_k = σ(u_kᵀx) so each token picks its own blend — strictly more
        expressive than any fixed activation (<strong>fixed ⊊ LA ⊊ MoA</strong>
        ), at O(28·d) cost vs O(d²) for the matmul.
      </p>
    </Widget>
  );
}

// ============================================================
// 9. KV cache quantization — codec tradeoff
// ============================================================
export function QuantizationDemo() {
  const [bits, setBits] = useState(3);
  // Real cosine vs fp16, Bench 022/024 (d=128, 512 keys). Hybrid ≈ OCTOPUS (0.998× MSE).
  const codecs = [
    {
      name: "Hybrid OCT+PQ",
      color: "#5fd38d",
      cos: { 2: 0.951, 3: 0.987, 4: 0.996, 8: 0.9995 },
    },
    {
      name: "SpectralQuant",
      color: "#dea584",
      cos: { 2: 0.937, 3: 0.981, 4: 0.993, 8: 0.999 },
    },
    {
      name: "TurboQuant",
      color: "#6ea8fe",
      cos: { 2: 0.905, 3: 0.955, 4: 0.976, 8: 0.997 },
    },
  ];
  const nearest = (m) =>
    m[bits] ??
    m[
      [2, 3, 4, 8].reduce((p, c) =>
        Math.abs(c - bits) < Math.abs(p - bits) ? c : p,
      )
    ];
  return (
    <Widget
      title="KV Cache Quantization"
      tag={`${bits}-bit`}
      hint="cosine similarity vs the fp16 baseline (Bench 022/024)"
    >
      <div className="control-row">
        <label>bit width</label>
        <input
          type="range"
          min="2"
          max="8"
          step="1"
          value={bits}
          onChange={(e) => setBits(+e.target.value)}
        />
        <span className="val">{bits}-bit</span>
      </div>
      {codecs.map((c) => {
        const cos = nearest(c.cos);
        return (
          <div className="probrow" key={c.name}>
            <span
              className="lab"
              style={{ width: 120, textAlign: "left", color: c.color }}
            >
              {c.name}
            </span>
            <span className="track">
              <span
                className="fill"
                style={{
                  width: `${((cos - 0.88) / 0.12) * 100}%`,
                  background: c.color,
                }}
              />
            </span>
            <span className="pct" style={{ width: 64 }}>
              {cos.toFixed(4)}
            </span>
          </div>
        );
      })}
      <p
        style={{
          fontSize: 13,
          color: "var(--faint)",
          marginTop: 14,
          marginBottom: 0,
        }}
      >
        <strong>Hybrid OCT+PQ</strong> is the default codec and the winner —
        OCTOPUS triplet encoding + PlanarQuant rotation, best MSE at every bit
        width plus <strong>64× fewer rotation FMAs</strong> (256 vs 16,384). The
        data-oblivious OCTOPUS core even beats calibrated{" "}
        <strong>SpectralQuant</strong> (−22% to −49% MSE on synthetic data).
        TurboQuant is the demoted legacy baseline.
      </p>
    </Widget>
  );
}

// ============================================================
// Architecture walkthrough — interactive vertical flow + detail panel
// ============================================================
const ARCH = [
  {
    id: "text",
    label: "Input text",
    sub: "raw UTF-8",
    role: "A string enters",
    color: "#9aa0b4",
    desc: "The prompt arrives as plain text — nothing is learned yet. Everything below turns it into one more token, then loops.",
  },
  {
    id: "tok",
    label: "Tokenizer",
    sub: "text → token ids",
    role: "Map text to ids",
    color: "#dea584",
    desc: "The default micro model is character-level — vocab_size 27 (BOS + a–z), matching the Chapter 01 demo. A full BPE tokenizer (BpeTokenizerImpl / BpeTrainer) ships in src/tokenizer and is exercised by the MTP benchmarks, but the default config does not use it.",
  },
  {
    id: "emb",
    label: "Embeddings",
    sub: "x = wte[tok] + wpe[pos]",
    role: "Look up meaning + position",
    color: "#f5b942",
    desc: "Each token id indexes a learned d-dim row of the token table (wte), and a learned positional row (wpe[pos]) is added on top — GPT-style absolute positions baked in right here. No RoPE.",
  },
  {
    id: "rms1",
    label: "RMSNorm 1",
    sub: "pre-attention norm",
    role: "Scale, don't center",
    color: "#dea584",
    desc: "Root-mean-square normalization: divide by the RMS of the vector, multiply by one learned scale per channel. No mean subtraction — cheaper and more stable than LayerNorm.",
  },
  {
    id: "attn",
    label: "Multi-Head Attention",
    sub: "Q/K/V → scores → mix",
    role: "Route between tokens",
    color: "#6ea8fe",
    skip: true,
    desc: "Causal scaled-dot-product attention over a KV cache. The code is GQA-capable via a head→kv-group LUT (h · n_kv_head / n_head), but the default micro config sets n_head = n_kv_head = 4, so it runs as plain multi-head attention — no K/V sharing. Under the hybrid pattern some layers swap in AHLA linear attention: a constant per-head recurrent state instead of a growing cache. (Chapter 06.)",
  },
  {
    id: "res1",
    label: "+ Residual",
    sub: "norm(x) + attn(norm(x))",
    role: "Add the skip path",
    color: "#6b7088",
    add: true,
    desc: "The attention output projection is added back to the saved residual. Note: xr is copied right after RMSNorm (transformer.rs:812), so the attention skip carries norm(x) — not the raw block input.",
  },
  {
    id: "rms2",
    label: "RMSNorm 2",
    sub: "pre-MLP norm",
    role: "Normalize again",
    color: "#dea584",
    desc: "A second RMSNorm before the feed-forward block — same operation, its own learned scale.",
  },
  {
    id: "mlp",
    label: "MLP (ReLU)",
    sub: "w2 · ReLU(w1 · norm(x))",
    role: "Think, per token",
    color: "#5fd38d",
    skip: true,
    desc: "A plain two-layer feed-forward: matmul → ReLU → matmul (matmul_relu, types.rs:1555), hidden width config.mlp_hidden. MoA SwiGLU — a per-token activation mix (Plan 158) — and SwiGLU exist as proven, feature-gated building blocks in coda.rs (try the mixer in Chapter 04), but they are not wired into the default forward, which uses ReLU.",
  },
  {
    id: "res2",
    label: "+ Residual",
    sub: "x + mlp(norm(x))",
    role: "Close the layer",
    color: "#6b7088",
    add: true,
    desc: "The MLP residual is saved before its RMSNorm (transformer.rs:892), so this adds the un-normalized post-attention activations back to the MLP output — completing one transformer layer. KatGPT-RS gets its strength from the structure around a small stack, not depth.",
  },
  {
    id: "logits",
    label: "Logits",
    sub: "vectors → vocab scores",
    role: "Score every token",
    color: "#f5b942",
    desc: "A final projection produces one score per vocabulary entry for the next position. Softmax + sampling would normally pick one — but KatGPT-RS does something smarter first.",
  },
  {
    id: "decode",
    label: "Speculative Decode Loop",
    sub: "draft → prune → verify → learn",
    role: "The KatGPT trick",
    color: "#b692f6",
    highlight: true,
    desc: "By default the next token is just sampled from the logits (plain autoregression). The speculative path accelerates that: a DDTree drafts several candidate continuations at once, the ConstraintPruner screens invalid branches before they cost a forward pass, the LeviathanVerifier accepts ≥1 token per target pass without changing the output distribution, and a bandit watches the accept rate to tune how hard to think next time. (Chapters 09–12.)",
  },
  {
    id: "next",
    label: "Next token",
    sub: "emitted · fed back",
    role: "Emit, then loop",
    color: "#5fd38d",
    desc: "The accepted token is emitted and appended to the input — and the whole machine runs again for the next one. A small model made formidable by the structure around it.",
  },
];

export function ArchitectureDemo() {
  const [sel, setSel] = useState("attn");
  const node = ARCH.find((n) => n.id === sel);

  const NW = 220,
    NH = 50,
    GAP = 14,
    PAD = 10;
  const W = 340;
  const cx = 20 + NW / 2;
  const yTop = (i) => PAD + i * (NH + GAP);
  const yMid = (i) => yTop(i) + NH / 2;
  const H = ARCH.length * (NH + GAP) - GAP + PAD * 2;

  // skip arcs bypass the norm+sublayer, landing on the residual add
  const skips = ARCH.map((n, i) =>
    n.skip ? { from: i - 1, to: i + 1 } : null,
  ).filter(Boolean);

  return (
    <Widget
      title="Anatomy of KatGPT-RS"
      tag="click a block"
      hint="one token's journey, end to end"
    >
      <div className="arch">
        <svg className="arch-flow" viewBox={`0 0 ${W} ${H}`} role="img">
          {/* vertical connectors */}
          {ARCH.slice(0, -1).map((n, i) => (
            <line
              key={`c${i}`}
              x1={cx}
              y1={yTop(i) + NH}
              x2={cx}
              y2={yTop(i + 1)}
              stroke="#2a2d3a"
              strokeWidth="2"
              markerEnd="url(#arch-arrow)"
            />
          ))}
          {/* skip / residual arcs */}
          {skips.map((s, k) => {
            const x0 = 20 + NW;
            const y0 = yMid(s.from);
            const y1 = yMid(s.to);
            const bulge = x0 + 56;
            return (
              <g key={`s${k}`}>
                <path
                  d={`M ${x0} ${y0} C ${bulge} ${y0}, ${bulge} ${y1}, ${x0} ${y1}`}
                  fill="none"
                  stroke="#3a3d4a"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x={bulge + 4}
                  y={(y0 + y1) / 2 + 3}
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                  fill="#6b7088"
                >
                  skip
                </text>
              </g>
            );
          })}
          {/* nodes */}
          {ARCH.map((n, i) => {
            const on = n.id === sel;
            return (
              <g
                key={n.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSel(n.id)}
              >
                <rect
                  x={20}
                  y={yTop(i)}
                  width={NW}
                  height={NH}
                  rx={n.add ? 24 : 10}
                  fill={n.color}
                  fillOpacity={on ? 0.92 : 0.15}
                  stroke={n.color}
                  strokeOpacity={on ? 1 : 0.55}
                  strokeWidth={on ? 2 : 1.2}
                />
                <text
                  x={cx}
                  y={yTop(i) + (n.sub ? 21 : 30)}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill={on ? "#0c0d12" : n.color}
                  style={{ fontFamily: "var(--sans)" }}
                >
                  {n.label}
                </text>
                {n.sub && (
                  <text
                    x={cx}
                    y={yTop(i) + 37}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    fill={on ? "#14110c" : "#6b7088"}
                    opacity={on ? 0.85 : 1}
                  >
                    {n.sub}
                  </text>
                )}
              </g>
            );
          })}
          <defs>
            <marker
              id="arch-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2d3a" />
            </marker>
          </defs>
        </svg>

        <div className="arch-panel">
          <div className="ap-kicker">SELECTED PART</div>
          <h4 style={{ color: node.color }}>{node.label}</h4>
          <div className="ap-role">{node.role}</div>
          {node.sub && <div className="ap-shape">{node.sub}</div>}
          <p>{node.desc}</p>
          {node.highlight && (
            <div className="ap-note">
              This loop is why a one-layer toy hits millions of tok/s — see
              Chapter 13.
            </div>
          )}
        </div>
      </div>
    </Widget>
  );
}

// ============================================================
// Percepta transformer-VM — a transformer that executes programs
// ============================================================
// Box descriptions mirror Percepta's own diagram (percepta.ai, Apache-2.0),
// mapped onto our pure-Rust RIIR module names.
const PVM_BUILD = [
  {
    id: "gates",
    label: "Gate primitives",
    sub: "gates.rs",
    desc: "A WebAssembly interpreter written CALM-style (Code for Append-only Lookup Machines) from primitive ops that map onto transformer parts: LookUp gates → attention heads, ReGLU gates → feed-forward, plus persist/multiply.",
  },
  {
    id: "graph",
    label: "Computation graph",
    sub: "graph/",
    desc: "The CALM program compiles into a DAG of two gate families — LookUp gates (attention) and ReGLU gates (feed-forward) — connected by linear wiring.",
  },
  {
    id: "sched",
    label: "MILP layer scheduler",
    sub: "scheduler.rs",
    desc: "A Mixed-Integer Linear Program assigns each gate (LookUp / ReGLU / Persist) to one of four phase-layers and a residual slot, minimizing model size (d_model).",
  },
  {
    id: "compile",
    label: "Compile → weights",
    sub: "weights.rs",
    desc: "Slot assignment, cancel masks and head packing turn the scheduled graph into ordinary transformer weight matrices. This whole row runs once.",
  },
];
const PVM_RUN = [
  {
    id: "src",
    label: "C / Rust source",
    sub: "Runner::compile",
    desc: "Any program — e.g. a Sudoku solver or the Hungarian algorithm. Runner::compile takes C, Runner::compile_rust takes Rust source.",
  },
  {
    id: "wasm",
    label: "WASM tokens",
    sub: "1 byte = 1 token",
    desc: "Compiled to WebAssembly (Clang for C), lowered so unsupported ops (MUL, DIV, shifts…) become basic instruction sequences, then tokenized — one byte of machine state per token.",
  },
  {
    id: "vm",
    label: "Transformer + HullKVCache",
    sub: "O(log N) attention",
    hot: true,
    desc: "The transformer executes the program step by step. Attention heads are restricted to d = 2, so each Q·K is a 2D geometric projection and the max-score lookup becomes a search over a convex hull (Convex Hull Trick, cht.rs / hull.rs) — O(log N) per step instead of brute-force O(N). A BruteAttentionHead ships as the O(N) reference for verification.",
  },
  {
    id: "exec",
    label: "Execution",
    sub: "program output",
    desc: "Running the transformer autoregressively produces the program’s execution trace, token by token.",
  },
];
const PVM_ALL = [...PVM_BUILD, ...PVM_RUN];

function PvmCell({ s, sel, onSel, last }) {
  return (
    <div className="pvm-cell">
      <button
        type="button"
        className={`pvm-node ${s.hot ? "hot" : ""} ${sel === s.id ? "sel" : ""}`}
        onClick={() => onSel(s.id)}
      >
        <span className="pvm-label">{s.label}</span>
        <span className="pvm-sub">{s.sub}</span>
      </button>
      {!last && <span className="pvm-arrow">→</span>}
    </div>
  );
}

export function PerceptaVMDemo() {
  const [sel, setSel] = useState("vm");
  const node = PVM_ALL.find((n) => n.id === sel);
  return (
    <Widget
      title="Percepta transformer-VM"
      tag="--features percepta"
      hint="click a box — a transformer that executes WASM programs (pure-Rust RIIR of Percepta's transformer-vm)"
    >
      <div className="pvm-kicker">
        BUILD THE MODEL <span>done once</span>
      </div>
      <div className="pvm-grid">
        {PVM_BUILD.map((s, i) => (
          <PvmCell
            key={s.id}
            s={s}
            sel={sel}
            onSel={setSel}
            last={i === PVM_BUILD.length - 1}
          />
        ))}
      </div>
      <div className="pvm-grid pvm-down">
        <span className="pvm-down-label">
          compiled weights become the transformer
        </span>
        <span className="pvm-down-arrow" aria-hidden="true">
          ↓
        </span>
      </div>
      <div className="pvm-kicker pvm-kicker-2">
        RUN A PROGRAM <span>at inference</span>
      </div>
      <div className="pvm-grid pvm-run">
        {PVM_RUN.map((s, i) => (
          <PvmCell
            key={s.id}
            s={s}
            sel={sel}
            onSel={setSel}
            last={i === PVM_RUN.length - 1}
          />
        ))}
      </div>
      <div className="pvm-detail">
        <div className="pvm-detail-label">
          {node.label} <code className="inline">{node.sub}</code>
        </div>
        <p>{node.desc}</p>
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--faint)",
          marginTop: 14,
          marginBottom: 0,
        }}
      >
        Gated behind <code className="inline">--features percepta</code>, it
        plugs back into the main stack at three points (
        <code className="inline">percepta/mod.rs</code>): DDTree branch pruning,
        the deterministic validator (state-machine rules as 2D keys), and a
        “free-embedding” bridge that projects hidden states to 2D for fast
        retrieval. See{" "}
        <code className="inline">examples/sudoku_04_percepta_vs.rs</code>.
      </p>
    </Widget>
  );
}

// ============================================================
// Sudoku — live in-browser WASM solver (3 engines, log + trace)
// Powered by crates/sudoku-wasm (port of src/percepta/legacy.rs).
// ============================================================
const SUDOKU_ENGINES = [
  { id: '9x9', label: '9×9', mode: 'brute', strat: 'plain backtracking' },
  { id: 'spec', label: 'Speculative', mode: 'fc', strat: 'forward-checked pruning' },
  { id: 'port', label: 'Percepta (port)', mode: 'port', strat: 'faithful CHT attention' },
  { id: 'opt', label: 'Percepta (optimize)', mode: 'opt', strat: 'MRV + monotonic hull' },
]
const MODE_OF = Object.fromEntries(SUDOKU_ENGINES.map((e) => [e.id, e.mode]))
// Arto Inkala — "World's Hardest Sudoku" (21 clues). Genuinely hard, so most
// engines don't finish on-screen; the live animation shows the opening search
// while the stats/chart report the full real solve.
const SUDOKU_PUZZLE = 'arto'

// turn an 81-char string into a 9×9 array of digits (0 = empty)
function parseGrid(s) {
  const g = Array.from({ length: 9 }, () => Array(9).fill(0))
  for (let i = 0; i < 81 && i < s.length; i++) g[(i / 9) | 0][i % 9] = +s[i] || 0
  return g
}

// engine-specific log line for one event; returns {text,color} or null
function fmtEvent(engine, ev, ctx) {
  const r = (ev.r ?? 0) + 1, c = (ev.c ?? 0) + 1, d = ev.d
  if (engine === '9x9') {
    if (ev.k === 0) return { text: `Trying ${d} at row ${r}, col ${c}.`, color: 'cy' }
    if (ev.k === 1) return { text: 'Looks good.', color: 'gn' }
    if (ev.k === 2) return { text: 'Contradiction.', color: 'rd' }
    if (ev.k === 3) return { text: `Undoing row ${r} col ${c}.`, color: 'or' }
    if (ev.k === 4) return { text: `Solved in ${ctx.steps} steps.`, color: 'gn' }
  } else if (engine === 'spec') {
    if (ev.k === 0) {
      const cell = `${ev.r},${ev.c}`
      if (ctx.lastCell !== cell) { ctx.lastCell = cell; return { text: `Cell (${r},${c}): draft 1–9 →`, color: 'cy' } }
      return null
    }
    if (ev.k === 2) return { text: `  ✗ ${d} pruned (row/col/box)`, color: 'rd' }
    if (ev.k === 1) return { text: `  ✓ ${d} verified → place`, color: 'gn' }
    if (ev.k === 3) return { text: `  ↩ undo (${r},${c})`, color: 'or' }
    if (ev.k === 4) return { text: 'All cells verified. Solved.', color: 'gn' }
  } else {
    // percepta: WASM execution trace framing
    if (ev.k === 1) { ctx.pc++; return { text: `step ${ctx.pc}: ▸ place ${d} @ (${r},${c})`, color: 'cy' } }
    if (ev.k === 2) return null
    if (ev.k === 3) { ctx.pc++; return { text: `step ${ctx.pc}: ◂ backtrack (${r},${c})`, color: 'or' } }
    if (ev.k === 4) return { text: `halt — trace ${ctx.trace} → hull ${ctx.hull} vertices`, color: 'gn' }
  }
  return null
}

export function SudokuDemo() {
  const [solveFn, setSolveFn] = useState(null)
  const [data, setData] = useState(null)
  const [times, setTimes] = useState(null)
  const [engine, setEngine] = useState('9x9')
  const [view, setView] = useState('log')
  const [, setTick] = useState(0)
  const [done, setDone] = useState(false)

  // mutable playback state
  const grid = useRef(Array.from({ length: 9 }, () => Array(9).fill(0)))
  const clues = useRef(Array.from({ length: 9 }, () => Array(9).fill(false)))
  const log = useRef([])
  const trace = useRef([])
  const idx = useRef(0)
  const ctx = useRef({})

  // lazy-load the wasm module once, then time each strategy (pure solve,
  // no trace-building) so the engines are comparable on the same puzzle.
  useEffect(() => {
    let live = true
    import('../wasm/sudoku/sudoku_wasm.js')
      .then((m) => m.default().then(() => {
        if (!live) return
        setSolveFn(() => m.solve)
        // Defer the (blocking) benchmark so first paint isn't held up. Take the
        // min of a few runs, but cap total time per engine (Arto brute is slow).
        setTimeout(() => {
          if (!live) return
          const t = {}
          for (const e of SUDOKU_ENGINES) {
            let best = Infinity, steps = 0, elapsed = 0, runs = 0
            while (runs < 9 && elapsed < 250) {
              const t0 = performance.now()
              steps = m.count_steps(SUDOKU_PUZZLE, e.mode)
              const dt = performance.now() - t0
              best = Math.min(best, dt)
              elapsed += dt
              runs++
            }
            t[e.id] = { steps, ms: best }
          }
          setTimes(t)
        }, 0)
      }))
      .catch((e) => console.error('sudoku wasm load failed', e))
    return () => { live = false }
  }, [])

  // (re)solve whenever the engine changes
  useEffect(() => {
    if (!solveFn) return
    const json = solveFn(SUDOKU_PUZZLE, MODE_OF[engine], 15000)
    const d = JSON.parse(json)
    // aggregate counts once (avoids re-filtering 8k events every frame)
    let tries = 0, pruned = 0, placed = 0
    for (const e of d.events) {
      if (e.k === 0) tries++
      else if (e.k === 2) pruned++
      else if (e.k === 1) placed++
    }
    d.tries = tries; d.pruned = pruned; d.placed = placed
    setData(d)
    // reset playback
    const g0 = parseGrid(d.puzzle)
    grid.current = g0.map((row) => row.slice())
    clues.current = g0.map((row) => row.map((v) => v > 0))
    log.current = []
    trace.current = []
    idx.current = 0
    ctx.current = { steps: d.steps, hull: d.hull, trace: d.trace, lastCell: '', pc: 0 }
    setDone(false)
    setTick((t) => t + 1)
  }, [solveFn, engine])

  // playback loop — reveal a chunk of events per frame.
  // Adaptive pace: play the whole (capped) trace in ~12s regardless of size.
  useEffect(() => {
    if (!data || done) return
    const CHUNK = Math.max(2, Math.ceil(data.events.length / 220))
    const id = setInterval(() => {
      const evs = data.events
      let n = 0
      while (n < CHUNK && idx.current < evs.length) {
        const ev = evs[idx.current++]
        // apply to board
        if (ev.k === 1) { grid.current[ev.r][ev.c] = ev.d; trace.current.push(ev.d) }
        else if (ev.k === 3) { grid.current[ev.r][ev.c] = 0; trace.current.push(-1) }
        const line = fmtEvent(engine, ev, ctx.current)
        if (line) { log.current.push(line); if (log.current.length > 200) log.current.shift() }
        n++
      }
      if (idx.current >= evs.length) {
        // End of the (possibly capped) trace: snap to the real solution so the
        // final frame shows the answer, not a deep tentative search state.
        if (data.answer) grid.current = parseGrid(data.answer)
        setDone(true)
      }
      setTick((t) => t + 1)
    }, 55)
    return () => clearInterval(id)
  }, [data, engine, done])

  const replay = () => {
    if (!data) return
    const g0 = parseGrid(data.puzzle)
    grid.current = g0.map((row) => row.slice())
    log.current = []
    trace.current = []
    idx.current = 0
    ctx.current = { steps: data.steps, hull: data.hull, trace: data.trace, lastCell: '', pc: 0 }
    setDone(false)
    setTick((t) => t + 1)
  }

  // unified, comparable stat line + engine-specific signature
  const fmtMs = (ms) => (ms < 1 ? ms.toFixed(2) : ms.toFixed(1))
  const statLine = () => {
    if (!data) return ''
    const tm = times?.[engine]
    const base = tm
      ? `${data.steps.toLocaleString()} steps · ${fmtMs(tm.ms)} ms`
      : `${data.steps.toLocaleString()} steps`
    if (engine === 'port')
      return `${base} · faithful CHT attention · trace ${data.trace.toLocaleString()} → hull ${data.hull}`
    if (engine === 'opt')
      return `${base} · MRV + monotonic hull · trace ${data.trace.toLocaleString()} → hull ${data.hull}`
    if (engine === 'spec')
      return `${base} · ${data.pruned.toLocaleString()} candidates pruned`
    return `${base} · plain backtracking`
  }

  const tokens = trace.current.slice(-120)
  const lines = log.current.slice(-15)

  return (
    <Widget
      title="Watch it solve — live WASM"
      tag={solveFn ? 'sudoku-wasm' : 'loading wasm…'}
      hint="real Rust solver compiled to WebAssembly, running in your browser"
    >
      <div className="sk-tabs">
        {SUDOKU_ENGINES.map((e) => (
          <button key={e.id} type="button"
            className={`sk-tab ${engine === e.id ? 'on' : ''}`}
            onClick={() => setEngine(e.id)}>{e.label}</button>
        ))}
        <button type="button" className="sk-replay" onClick={replay}>↻ replay</button>
      </div>

      <div className="sk-body">
        <div className="sk-left">
          <div className="sk-user">
            <div className="sk-role">USER</div>
            <div className="sk-prompt">Solve this Sudoku puzzle:</div>
          </div>
          <div className="sk-stat">
            <span className="sk-bolt">⚡</span> {statLine()}
          </div>
          <div className="sk-assistant">
            <div className="sk-role">ASSISTANT</div>
            <div className="sk-stream">
              {view === 'log'
                ? lines.map((l, i) => <div key={i} className={`sk-line ${l.color}`}>{l.text}</div>)
                : <div className="sk-trace">{tokens.map((t, i) =>
                    <span key={i} className={t < 0 ? 'tk back' : 'tk'}>{t < 0 ? '↩' : t}</span>)}</div>}
              {!done && <span className="sk-caret" />}
              {done && data?.capped && (
                <div className="sk-status">
                  ▸ solved in {data.steps.toLocaleString()} steps — board shows the answer
                  (live view truncated at {data.events.length.toLocaleString()} search events)
                </div>
              )}
            </div>
            <div className="sk-subtabs">
              <button type="button" className={view === 'log' ? 'on' : ''} onClick={() => setView('log')}>Readable log</button>
              <button type="button" className={view === 'trace' ? 'on' : ''} onClick={() => setView('trace')}>Token trace</button>
            </div>
          </div>
        </div>

        <div className="sk-board">
          {grid.current.map((row, r) => row.map((v, c) => (
            <div key={`${r}-${c}`}
              className={`sk-cell ${clues.current[r]?.[c] ? 'clue' : v ? 'fill' : ''} ${c % 3 === 2 && c !== 8 ? 'br' : ''} ${r % 3 === 2 && r !== 8 ? 'bb' : ''}`}>
              {v || ''}
            </div>
          )))}
        </div>
      </div>

      {times && (() => {
        const maxMs = Math.max(...SUDOKU_ENGINES.map((e) => times[e.id].ms))
        const fastest = SUDOKU_ENGINES.reduce((a, b) => (times[a.id].ms <= times[b.id].ms ? a : b)).id
        const baseMs = times['port'].ms // baseline = faithful Percepta port
        const rel = (id, ms) => {
          if (id === 'port') return 'Percepta baseline'
          const r = baseMs / ms
          if (r >= 1.05) return `${r.toFixed(1)}× faster than port`
          if (r <= 0.95) return `${(1 / r).toFixed(1)}× slower than port`
          return '≈ port'
        }
        return (
          <div className="sk-compare">
            <div className="sk-compare-title">
              Solve time — Arto Inkala (world's hardest), four engines <span>(full solve, vs Percepta port; lower is faster)</span>
            </div>
            <div className="sk-headline">
              Our <strong>Percepta (optimize)</strong> solves it{' '}
              <strong>{(times['port'].ms / times['opt'].ms).toFixed(1)}× faster</strong> than the faithful{' '}
              <strong>Percepta (port)</strong> — same answer, every Rust trick allowed.
            </div>
            {SUDOKU_ENGINES.map((e) => {
              const tm = times[e.id]
              const win = e.id === fastest
              return (
                <div className="sk-cmp-row" key={e.id}>
                  <div className="sk-cmp-label">{e.label} <span>{e.strat}</span></div>
                  <div className="sk-cmp-track">
                    <div className={`sk-cmp-fill ${win ? 'win' : ''}`} style={{ width: `${Math.max((tm.ms / maxMs) * 100, 1.5)}%` }} />
                  </div>
                  <div className="sk-cmp-val">
                    <div>{fmtMs(tm.ms)} ms · {tm.steps.toLocaleString()} steps</div>
                    <div className={`sk-cmp-x ${e.id === fastest ? 'win' : ''}`}>{rel(e.id, tm.ms)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 14, marginBottom: 0 }}>
        Four engines, same puzzle, all live in WebAssembly. <strong>9×9</strong> is plain backtracking;{' '}
        <strong>Speculative</strong> adds forward-checking (abandon a branch the moment any cell has zero
        candidates). <strong>Percepta (port)</strong> records every step into a{' '}
        <em>faithful CHT HardAttentionHead</em> — a direct port of Percepta's{' '}
        <code className="inline">hull2d_cht.h</code> (the real O(log N) attention), on a plain
        backtracking trace like the original transformer-vm executes.{' '}
        <strong>Percepta (optimize)</strong> is the RIIR win — every trick allowed: most-constrained-cell
        ordering collapses the search tree (≈49.6k → ≈13.8k steps on Arto) and a monotonic-X Graham hull
        replaces the general CHT (amortized O(1) insert). Note the port and optimize use different
        strategies on purpose — “as faithful as possible” vs “as fast as possible.” The puzzle is Arto
        Inkala, the world's hardest (21 clues), so the live board shows the opening search rather than a
        full finish; the chart reports the complete solve.
      </p>
    </Widget>
  )
}
