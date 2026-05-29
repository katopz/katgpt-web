import { useState, useMemo } from 'react'

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
  )
}

const softmax = (logits, t) => {
  const tt = Math.max(t, 1e-3)
  const m = Math.max(...logits)
  const ex = logits.map((l) => Math.exp((l - m) / tt))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((e) => e / s)
}

// ============================================================
// 1. Tokenizer — char → vocab index (micro model: BOS + a..z)
// ============================================================
export function TokenizerDemo() {
  const [text, setText] = useState('hello world')
  const tokens = useMemo(() => {
    const clean = text.toLowerCase()
    const out = [{ ch: '·', idx: 0, label: 'BOS' }]
    for (const c of clean) {
      if (c >= 'a' && c <= 'z') out.push({ ch: c, idx: c.charCodeAt(0) - 96, label: c })
      else if (c === ' ') out.push({ ch: '␣', idx: -1, label: 'oov' })
      else out.push({ ch: c, idx: -1, label: 'oov' })
    }
    return out
  }, [text])

  const colors = ['#dea584', '#f5b942', '#5fd38d', '#6ea8fe', '#b692f6', '#f0716f']
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
                ? { borderColor: '#f0716f', color: '#f0716f' }
                : { borderColor: colors[t.idx % colors.length], color: colors[t.idx % colors.length] }
            }
            title={t.idx < 0 ? 'out of vocab' : `index ${t.idx}`}
          >
            {t.label}
            <span style={{ color: 'var(--faint)', marginLeft: 6 }}>
              {t.idx < 0 ? '—' : t.idx}
            </span>
          </span>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 0 }}>
        {tokens.length} tokens · the real BPE tokenizer (<code className="inline">Config::bpe()</code>)
        learns merges for code; this micro vocab keeps the reference model tiny.
      </p>
    </Widget>
  )
}

// ============================================================
// 2. Temperature sampler
// ============================================================
export function TemperatureSampler() {
  const [t, setT] = useState(0.5)
  const cands = ['l', 'p', 'd', 'm', 'a']
  const logits = [3.4, 2.1, 1.3, 0.6, 0.1]
  const probs = softmax(logits, t)
  return (
    <Widget title="Logits → Sampling" tag={`temperature = ${t.toFixed(2)}`} hint="after the prompt “hel…”">
      <div className="control-row">
        <label>temperature</label>
        <input type="range" min="0.05" max="2" step="0.05" value={t} onChange={(e) => setT(+e.target.value)} />
        <span className="val">{t.toFixed(2)}</span>
      </div>
      {cands.map((c, i) => (
        <div className="probrow" key={c}>
          <span className="lab">{c}</span>
          <span className="track"><span className="fill" style={{ width: `${probs[i] * 100}%` }} /></span>
          <span className="pct">{(probs[i] * 100).toFixed(1)}%</span>
        </div>
      ))}
      <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 0 }}>
        Low temperature sharpens toward the argmax (greedy); high temperature flattens the
        distribution. The reference model ships with <code className="inline">temperature = 0.5</code>.
      </p>
    </Widget>
  )
}

// ============================================================
// 3. DDTree — best-first draft tree under a node budget
// ============================================================
export function DDTreeDemo() {
  const [budget, setBudget] = useState(7)
  // a fixed candidate tree; each node has a marginal log-prob (lp)
  const nodes = useMemo(
    () => [
      { id: 0, x: 0.5, y: 0, parent: null, tok: 'BOS', lp: 0 },
      { id: 1, x: 0.28, y: 1, parent: 0, tok: 't', lp: -0.4 },
      { id: 2, x: 0.62, y: 1, parent: 0, tok: 'a', lp: -0.9 },
      { id: 3, x: 0.84, y: 1, parent: 0, tok: 'o', lp: -1.7 },
      { id: 4, x: 0.18, y: 2, parent: 1, tok: 'h', lp: -0.7 },
      { id: 5, x: 0.4, y: 2, parent: 1, tok: 'e', lp: -1.3 },
      { id: 6, x: 0.6, y: 2, parent: 2, tok: 'n', lp: -1.4 },
      { id: 7, x: 0.78, y: 2, parent: 3, tok: 'k', lp: -2.5 },
      { id: 8, x: 0.12, y: 3, parent: 4, tok: 'e', lp: -1.0 },
      { id: 9, x: 0.3, y: 3, parent: 4, tok: 'i', lp: -1.9 },
      { id: 10, x: 0.55, y: 3, parent: 6, tok: 'd', lp: -2.0 },
    ],
    []
  )
  // cumulative score = sum of lp along path
  const score = useMemo(() => {
    const map = {}
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    for (const n of nodes) {
      let s = 0, cur = n
      while (cur) { s += cur.lp; cur = cur.parent != null ? byId[cur.parent] : null }
      map[n.id] = s
    }
    return map
  }, [nodes])
  // best-first: expand root, then highest-scoring frontier nodes up to budget
  const expanded = useMemo(() => {
    // best-first proxy: always keep root, then highest cumulative-score nodes
    const ranked = [...nodes].sort((a, b) => score[b.id] - score[a.id])
    const keep = new Set([0])
    for (const n of ranked) { if (keep.size >= budget) break; keep.add(n.id) }
    return keep
  }, [nodes, score, budget])

  const W = 460, H = 230, pad = 24
  const px = (x) => pad + x * (W - 2 * pad)
  const py = (y) => pad + (y / 3) * (H - 2 * pad)

  return (
    <Widget title="DDTree — Dynamic Draft Tree" tag={`budget = ${budget} nodes`} hint="best-first expansion by cumulative log-prob">
      <div className="control-row">
        <label>node budget</label>
        <input type="range" min="1" max="11" step="1" value={budget} onChange={(e) => setBudget(+e.target.value)} />
        <span className="val">{budget}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {nodes.map((n) =>
          n.parent != null ? (
            <line
              key={`e${n.id}`}
              x1={px(nodes.find((p) => p.id === n.parent).x)}
              y1={py(n.parent === null ? 0 : nodes.find((p) => p.id === n.parent).y)}
              x2={px(n.x)} y2={py(n.y)}
              stroke={expanded.has(n.id) ? '#dea584' : '#2a2d3a'}
              strokeWidth={expanded.has(n.id) ? 2 : 1}
            />
          ) : null
        )}
        {nodes.map((n) => {
          const on = expanded.has(n.id)
          return (
            <g key={n.id}>
              <circle cx={px(n.x)} cy={py(n.y)} r={15}
                fill={on ? '#f97316' : '#1f222e'}
                stroke={on ? '#f5b942' : '#2a2d3a'} strokeWidth={1.5} />
              <text x={px(n.x)} y={py(n.y) + 4} textAnchor="middle"
                fontSize="12" fontFamily="ui-monospace, monospace"
                fill={on ? '#14110c' : '#6b7088'}>{n.tok}</text>
            </g>
          )
        })}
      </svg>
      <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 0 }}>
        A <code className="inline">BinaryHeap</code> drives Best-First Search: the tree spends its
        budget on the highest cumulative-probability branches first. Invalid branches are pruned
        <em> before</em> they ever reach the verifier.
      </p>
    </Widget>
  )
}

// ============================================================
// 4. ScreeningPruner relevance threshold
// ============================================================
export function ScreeningPrunerDemo() {
  const [thr, setThr] = useState(0.4)
  const branches = [
    { tok: '5', r: 0.95 }, { tok: '3', r: 0.81 }, { tok: '8', r: 0.62 },
    { tok: '1', r: 0.44 }, { tok: '9', r: 0.30 }, { tok: 'x', r: 0.12 },
    { tok: '?', r: 0.04 },
  ]
  const kept = branches.filter((b) => b.r >= thr).length
  return (
    <Widget title="ScreeningPruner — graded relevance" tag={`R ≥ ${thr.toFixed(2)}`} hint="R ∈ [0,1] replaces binary valid/invalid">
      <div className="control-row">
        <label>relevance cutoff</label>
        <input type="range" min="0" max="1" step="0.01" value={thr} onChange={(e) => setThr(+e.target.value)} />
        <span className="val">{thr.toFixed(2)}</span>
      </div>
      {branches.map((b) => {
        const on = b.r >= thr
        return (
          <div className="probrow" key={b.tok} style={{ opacity: on ? 1 : 0.35 }}>
            <span className="lab">{b.tok}</span>
            <span className="track">
              <span className="fill" style={{ width: `${b.r * 100}%`, background: on ? undefined : '#3a3d4a' }} />
            </span>
            <span className="pct" style={{ color: on ? 'var(--green)' : 'var(--red)' }}>
              {on ? 'keep' : 'prune'}
            </span>
          </div>
        )
      })}
      <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 0 }}>
        <span className="kicker">{kept}/{branches.length}</span> branches survive. The
        <code className="inline">BanditPruner</code> learns this cutoff online — hitting a 100% goal
        rate where a fixed binary pruner gets 0% at a tight budget.
      </p>
    </Widget>
  )
}

// ============================================================
// 5. Speculative accept-length
// ============================================================
export function AcceptLengthDemo() {
  const [gamma, setGamma] = useState(8)
  const [seed, setSeed] = useState(2)
  // deterministic pseudo-accept based on seed + gamma
  const accepted = useMemo(() => {
    let a = 0
    for (let i = 0; i < gamma; i++) {
      const r = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 7.233)) % 1
      if (r > 0.18) a++; else break
    }
    return Math.min(a + 1, gamma + 1) // Leviathan: always ≥1, up to γ+1
  }, [gamma, seed])
  return (
    <Widget title="Speculative Verification" tag={`γ = ${gamma} draft tokens`} hint="LeviathanVerifier — always ≥1 token, up to γ+1">
      <div className="control-row">
        <label>draft length γ</label>
        <input type="range" min="1" max="12" step="1" value={gamma} onChange={(e) => setGamma(+e.target.value)} />
        <span className="val">{gamma}</span>
        <button className="btn ghost" onClick={() => setSeed((s) => s + 1)}>resample</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
        {Array.from({ length: gamma + 1 }).map((_, i) => (
          <div key={i} style={{
            width: 30, height: 30, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: 12,
            background: i < accepted ? '#5fd38d' : '#1f222e',
            color: i < accepted ? '#0c0d12' : '#6b7088',
            border: '1px solid var(--border)',
          }}>{i < accepted ? '✓' : i === gamma ? '+' : '·'}</div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 14, marginBottom: 0 }}>
        <span className="kicker">{accepted} tokens accepted</span> from one verifier pass.
        Residual sampling guarantees the output distribution is identical to the target model —
        the speedup is free. Benchmarks hit <strong>avg accept len 7.0</strong> on the AR draft path.
      </p>
    </Widget>
  )
}

// ============================================================
// 6. Raven RSM — O(1) routing slots
// ============================================================
export function RavenSlotsDemo() {
  const [count, setCount] = useState(0)
  const [active, setActive] = useState(new Set())
  const SLOTS = 16, K = 3
  const step = () => {
    const n = count + 1
    // top-K routing: hash token -> K slots
    const sel = new Set()
    for (let j = 0; j < K; j++) sel.add((n * 7 + j * 5 + j * j * 3) % SLOTS)
    setActive(sel)
    setCount(n)
  }
  return (
    <Widget title="Raven RSM — O(1) routing slot memory" tag="16 slots, Top-3" hint="KV memory stays constant regardless of sequence length">
      <div className="control-row">
        <button className="btn" onClick={step}>process next token</button>
        <button className="btn ghost" onClick={() => { setCount(0); setActive(new Set()) }}>reset</button>
        <span className="w-hint">tokens processed: <span className="val" style={{ minWidth: 'auto' }}>{count}</span></span>
      </div>
      <div className="slots">
        {Array.from({ length: SLOTS }).map((_, i) => (
          <div key={i} className={`slot ${active.has(i) ? 'active' : 'frozen'}`}>{i}</div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 14, marginBottom: 0 }}>
        Only the Top-3 routed slots update; the rest are <strong>completely frozen</strong>. After 1000
        noisy updates the model still retrieves the passkey — at <strong>9.25M tok/s</strong> recall.
        GDN2 generalises this to a constant per-head state for <strong>87–98% memory savings</strong>.
      </p>
    </Widget>
  )
}

// ============================================================
// 7. KV cache quantization — codec tradeoff
// ============================================================
export function QuantizationDemo() {
  const [bits, setBits] = useState(3)
  // anchored to README benchmarks; simple monotone models per codec
  const codecs = [
    { name: 'SpectralQuant', color: '#5fd38d', cos: { 2: 0.972, 3: 0.9917, 4: 0.997, 8: 0.9995 }, comp: 16 / 1.76 },
    { name: 'Hybrid OCT+PQ', color: '#dea584', cos: { 2: 0.961, 3: 0.987, 4: 0.994, 8: 0.9991 }, comp: 16 / 3 },
    { name: 'TurboQuant', color: '#6ea8fe', cos: { 2: 0.93, 3: 0.9692, 4: 0.985, 8: 0.998 }, comp: 16 / 3 },
  ]
  const nearest = (m) => m[bits] ?? m[[2, 3, 4, 8].reduce((p, c) => (Math.abs(c - bits) < Math.abs(p - bits) ? c : p))]
  return (
    <Widget title="KV Cache Quantization" tag={`${bits}-bit`} hint="cosine similarity vs the fp16 baseline">
      <div className="control-row">
        <label>bit width</label>
        <input type="range" min="2" max="8" step="1" value={bits} onChange={(e) => setBits(+e.target.value)} />
        <span className="val">{bits}-bit</span>
      </div>
      {codecs.map((c) => {
        const cos = nearest(c.cos)
        return (
          <div className="probrow" key={c.name}>
            <span className="lab" style={{ width: 120, textAlign: 'left', color: c.color }}>{c.name}</span>
            <span className="track">
              <span className="fill" style={{ width: `${((cos - 0.92) / 0.08) * 100}%`, background: c.color }} />
            </span>
            <span className="pct" style={{ width: 64 }}>{cos.toFixed(4)}</span>
          </div>
        )
      })}
      <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 14, marginBottom: 0 }}>
        <strong>SpectralQuant</strong> wins on calibrated quality (9.1× compression, cosine 0.9917);
        <strong> Hybrid OCT+PQ</strong> is the default data-oblivious codec with 64× fewer rotation
        FMAs. TurboQuant is kept only as an educational baseline.
      </p>
    </Widget>
  )
}
