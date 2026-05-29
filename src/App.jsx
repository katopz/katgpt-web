import { useEffect, useState } from 'react'
import { Stat, Card, Code, Pipeline, DataTable, Badge, BarChart } from './components/ui.jsx'
import {
  TokenizerDemo,
  TemperatureSampler,
  DDTreeDemo,
  ScreeningPrunerDemo,
  AcceptLengthDemo,
  RavenSlotsDemo,
  QuantizationDemo,
  MoaMixerDemo,
  ArchitectureDemo,
  PerceptaVMDemo,
  SudokuDemo,
} from './components/widgets.jsx'

const CHAPTERS = [
  { id: 'intro', title: 'Introduction' },
  { id: 'tokenization', title: 'Tokenization' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'forward', title: 'The Forward Pass' },
  { id: 'sampling', title: 'Logits & Sampling' },
  { id: 'ddtree', title: 'DDTree Draft Trees' },
  { id: 'pruning', title: 'Neuro-Symbolic Pruning' },
  { id: 'speculative', title: 'Speculative Verification' },
  { id: 'recurrent', title: 'Recurrent Attention' },
  { id: 'kvcache', title: 'KV Cache Compression' },
  { id: 'scaling', title: 'Adaptive Test-Time Scaling' },
  { id: 'selfplay', title: 'Self-Play & Arenas' },
  { id: 'benchmarks', title: 'Benchmark Results' },
  { id: 'stack', title: 'Research → Code → Proof' },
  { id: 'together', title: 'Putting It Together' },
  { id: 'percepta', title: 'Percepta VM' },
  { id: 'sudoku', title: 'Watch It Solve' },
]

function Section({ id, num, title, intro, children }) {
  return (
    <section className="section" id={id}>
      <div className="chap-num">CHAPTER {String(num).padStart(2, '0')}</div>
      <h2>{title}</h2>
      {intro && <p className="intro">{intro}</p>}
      {children}
    </section>
  )
}

export default function App() {
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState('intro')

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight)
      setProgress(p * 100)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id)
        })
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    CHAPTERS.forEach((c) => {
      const el = document.getElementById(c.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <div className="progress-bar" style={{ width: `${progress}%` }} />
      <nav className="topnav">
        <span className="brand"><span className="logo">▲</span> KatGPT-RS</span>
        <span className="spacer" />
        <a className="ghlink" href="https://github.com/katopz/katgpt-rs" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </nav>

      <div className="layout">
        <aside className="sidebar">
          <ol>
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className={active === c.id ? 'active' : ''}>
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <main className="content">
          <header className="hero">
            <div className="eyebrow">An interactive walkthrough</div>
            <h1>
              The Anatomy of <span className="grad">KatGPT-RS</span>
            </h1>
            <p className="lede">
              A neuro-symbolic micro-Transformer with speculative decoding, constraint pruning,
              recurrent attention, and adaptive test-time scaling — built in Rust. Text becomes
              tokens, tokens become vectors, and the vectors move through layers of attention while
              a deterministic validator quietly prunes the impossible.
            </p>
            <div className="pills">
              <span className="pill rust">Rust · edition 2024</span>
              <span className="pill">zero-alloc forward pass</span>
              <span className="pill">SIMD NEON / AVX2</span>
              <span className="pill">~3.6M tok/s on M-series</span>
              <span className="pill">740+ tests</span>
            </div>
          </header>

          {/* 1 ---------------------------------------------------- */}
          <Section
            id="intro" num={1} title="Introduction"
            intro="Most LLM walkthroughs stop at the forward pass. KatGPT-RS is built around a different thesis: a small model plus deterministic structure can beat a big model plus brute force."
          >
            <p>
              The reference model is deliberately tiny — a 1-layer GPT with a 27-token vocabulary,
              matching the <a href="https://github.com/AlexCheema/talos-vs-macbook">talos-vs-macbook</a>{' '}
              model. Everything interesting happens <em>around</em> that core: a draft tree, a rules
              engine, a verifier, recurrent memory, a compressed KV cache, and a bandit that learns
              how hard to think. This page walks the full pipeline, chapter by chapter, the way the
              tokens actually flow.
            </p>
            <div className="grid-3">
              <Stat num="27" label="vocab size (BOS + a–z)" />
              <Stat num="7–8" label="tokens / verifier pass (accept len)" tone="green" />
              <Stat num="O(1)" label="Raven routing memory" tone="blue" />
            </div>
            <Pipeline
              steps={[
                { label: 'LLM drafts logits' },
                { label: 'ConstraintPruner filters', accent: true },
                { label: 'DDTree builds valid-only tree', accent: true },
                { label: 'Target verifies' },
              ]}
            />
          </Section>

          {/* 2 ---------------------------------------------------- */}
          <Section
            id="tokenization" num={2} title="Tokenization"
            intro="Before any math, text is chopped into discrete tokens. The micro model uses a character vocabulary; production code trains real BPE merges."
          >
            <TokenizerDemo />
            <p>
              The <code className="inline">Config::bpe()</code> preset trains byte-pair merges tuned
              for code generation, then encodes and decodes losslessly. For the reference model the
              vocabulary is just <code className="inline">BOS + a..z</code> — 27 tokens — which keeps
              every matrix small enough to inspect by hand.
            </p>
          </Section>

          {/* 3 ---------------------------------------------------- */}
          <Section
            id="architecture" num={3} title="Architecture"
            intro="The reference model is intentionally small. The point is not raw capacity — it is everything wrapped around the core forward pass."
          >
            <DataTable
              head={['Parameter', 'Value', 'Note']}
              rows={[
                [<code className="inline">vocab_size</code>, '27', 'a–z + BOS'],
                [<code className="inline">block_size</code>, '16', 'context length'],
                [<code className="inline">n_embd</code>, '16', 'embedding dim'],
                [<code className="inline">n_head</code>, '4', 'attention heads'],
                [<code className="inline">mlp_hidden</code>, '64', '4× expansion'],
                [<code className="inline">n_layer</code>, '1', 'transformer blocks'],
                [<code className="inline">temperature</code>, '0.5', 'sampling sharpness'],
              ]}
            />
            <p>
              That is the whole network. Real leverage comes from the routing and conditioning layer:
              a <code className="inline">KeywordRouter</code> + <code className="inline">ExpertRegistry</code>{' '}
              pick a pruner and LoRA per prompt, prefill attends bidirectionally, and modality LoRAs
              swap by reference (zero data movement) between reading and writing.
            </p>
          </Section>

          {/* 4 ---------------------------------------------------- */}
          <Section
            id="forward" num={4} title="The Forward Pass"
            intro="A full GPT forward pass — RMSNorm, multi-head causal attention, a ReLU MLP, the KV cache — but with every per-step heap allocation removed."
          >
            <p>
              The hot path runs through a pre-allocated <code className="inline">ForwardContext</code>:
              scratch buffers are reused across steps so a decode loop performs <strong>zero
              allocations</strong>. Element loops are SIMD-ified (NEON / AVX2) and softmax is computed
              without intermediate vectors.
            </p>
            <Code>{`pub trait ConstraintPruner: Send + Sync {
    fn is_valid(&self, depth: usize, token_idx: usize,
                parent_tokens: &[usize]) -> bool;
}

pub trait ScreeningPruner: Send + Sync {
    fn relevance(&self, depth: usize, token_idx: usize,
                 parent_tokens: &[usize]) -> f32;
}

pub trait SpeculativeVerifier: Send + Sync {
    fn speculate(&mut self, draft_weights, draft_config,
                 token, pos, rng) -> Vec<usize>;
}`}</Code>
            <p>
              These three traits are the seams of the whole system. Everything downstream — pruners,
              verifiers, bandits — plugs in here.
            </p>
            <h3>Mixture of Activations (Plan 158)</h3>
            <p>
              The FFN's fixed activation is the cheapest place to buy expressivity. <strong>MoA</strong>{' '}
              replaces the single ReLU/SiLU with a token-adaptive blend over a 7-activation
              dictionary — a sigmoid gate <code className="inline">π_k = σ(u_kᵀx)</code> picks each
              token's mix. It is provably more expressive than any fixed activation
              (<code className="inline">fixed ⊊ LA ⊊ MoA</code>), costs O(28·d) vs O(d²) for the
              matmul, and folds into the fused kernel <code className="inline">simd_matmul_rmsnorm_moa_swiglu</code>.
            </p>
            <MoaMixerDemo />
          </Section>

          {/* 5 ---------------------------------------------------- */}
          <Section
            id="sampling" num={5} title="Logits & Sampling"
            intro="The forward pass ends in logits over the vocabulary. Temperature decides how adventurous the next-token choice is."
          >
            <TemperatureSampler />
          </Section>

          {/* 6 ---------------------------------------------------- */}
          <Section
            id="ddtree" num={6} title="DDTree — Dynamic Draft Trees"
            intro="Instead of one greedy draft chain, KatGPT builds a tree of candidate continuations and explores the most promising branches first."
          >
            <DDTreeDemo />
            <p>
              The <strong>DDTree</strong> (Dynamic Draft Tree) uses a <code className="inline">BinaryHeap</code>{' '}
              for Best-First Search over marginal log-probabilities. Width beats depth: sweeping K=1→20
              costs only linear latency for +0.15% quality, while pushing depth T=1→16 <em>loses</em>{' '}
              32% quality. So the budget is spent wide.
            </p>
          </Section>

          {/* 7 ---------------------------------------------------- */}
          <Section
            id="pruning" num={7} title="Neuro-Symbolic Pruning"
            intro="LLMs draft from semantic probability but can't natively enforce hard constraints. A deterministic rules engine sits between draft and verification."
          >
            <ScreeningPrunerDemo />
            <p>
              The <code className="inline">ConstraintPruner</code> answers a binary question — is this
              branch valid? The <code className="inline">ScreeningPruner</code> upgrades that to graded
              relevance via <code className="inline">ln(R)</code> blending. Proven on Sudoku, a
              path-aware pruner catches <strong>100%</strong> of invalid branches:
            </p>
            <Code>{`Unpruned:    100 nodes,  46 accumulated-valid (46.0%)
Static-Only: 100 nodes,  84 accumulated-valid (84.0%)
Path-Aware:  100 nodes, 100 accumulated-valid (100.0%)`}</Code>
            <p>
              On Arto Inkala's "World's Hardest Sudoku": 49,559 steps, 7 hull vertices,
              <strong> 7,079.9× compression</strong>. Pruners compose — <code className="inline">BanditPruner</code>{' '}
              wraps any screener with exploration; <code className="inline">WasmPruner</code> loads
              sandboxed <code className="inline">.wasm</code> validators.
            </p>
          </Section>

          {/* 8 ---------------------------------------------------- */}
          <Section
            id="speculative" num={8} title="Speculative Verification"
            intro="A small draft model proposes several tokens; the target model verifies them in a single pass — and the output distribution is provably unchanged."
          >
            <AcceptLengthDemo />
            <p>
              The <code className="inline">LeviathanVerifier</code> implements exact residual (p/q
              rejection) sampling: at least one token per step, up to γ+1 on a lucky pass, with output
              identical to plain autoregressive decoding. A <code className="inline">SimulatedVerifier</code>{' '}
              is available for fast experiments.
            </p>
          </Section>

          {/* 9 ---------------------------------------------------- */}
          <Section
            id="recurrent" num={9} title="Recurrent Attention"
            intro="Quadratic attention grows with context. KatGPT ships constant-memory alternatives that keep a fixed-size state."
          >
            <RavenSlotsDemo />
            <div className="grid-2">
              <Card title="Raven RSM">
                O(1) KV replacement with sparse Top-K routing. Unselected slots are completely frozen —
                16 slots regardless of sequence length.
              </Card>
              <Card title="GDN2 — Gated DeltaNet-2">
                Constant per-head state S ∈ ℝ<sup>dk×dv</sup>. 99.4% of linear-attention throughput,
                87–98% memory savings. GOAT 14/14.
              </Card>
            </div>
          </Section>

          {/* 10 --------------------------------------------------- */}
          <Section
            id="kvcache" num={10} title="KV Cache Compression"
            intro="The KV cache dominates memory at long context. KatGPT compresses it aggressively while tracking the quality cost honestly."
          >
            <QuantizationDemo />
            <p>
              The default codec — and the winner — is <strong>Hybrid OCT+PQ</strong>: OCTOPUS triplet
              encoding plus a PlanarQuant 2D Givens rotation. It posts the best MSE at every bit width
              (≈ pure OCTOPUS, slightly better) while using <strong>64× fewer rotation FMAs</strong>{' '}
              (256 vs 16,384). Strikingly, the data-oblivious OCTOPUS core beats <strong>SpectralQuant</strong>'s
              calibrated eigenbasis at every bit width on synthetic data (−22% to −49% MSE) — though
              SpectralQuant's calibration may narrow that gap on real activations with strong
              eigenvalue decay. TurboQuant is the demoted legacy baseline.
            </p>
          </Section>

          {/* 11 --------------------------------------------------- */}
          <Section
            id="scaling" num={11} title="Adaptive Test-Time Scaling"
            intro="How hard should the model think about this token? KatGPT learns the answer instead of hard-coding it."
          >
            <div className="grid-2">
              <Card title="Early Exit & Dynamic Budget">
                Confidence-gap early exit in DDTree Phase C: when the best path dominates for{' '}
                <code className="inline">patience</code> iterations beyond a score{' '}
                <code className="inline">gap</code>, expansion stops. Per-domain budgets load from TOML.
              </Card>
              <Card title="Multi-Armed Bandit">
                UCB1 / ε-greedy / Thompson strategies pick the screening policy online.
                <strong> +37.5pp survival</strong> (95.4% vs 57.8%) with a shared bandit.
              </Card>
              <Card title="SR²AM Configurator">
                UCB1 over PlanNew / PlanExtend / PlanSkip arms with entropy-aware horizon truncation —
                per-turn regulation of how much planning to do.
              </Card>
              <Card title="SpecHop">
                Hop-level speculation for multi-step agents: an α/β/p cost model, k-bounded window, and
                a HopDDTree extend token-level speculation up to whole reasoning hops.
              </Card>
            </div>
            <p>
              Underneath sits a full <strong>Heuristic Learning</strong> pipeline —{' '}
              <code className="inline">TrialLog</code>, <code className="inline">AbsorbCompress</code>,{' '}
              <code className="inline">HotSwapPruner</code>, <code className="inline">RegressionSuite</code>{' '}
              — running at <strong>1.16M cycles/sec</strong> with zero hot-path overhead.
            </p>
          </Section>

          {/* 12 --------------------------------------------------- */}
          <Section
            id="selfplay" num={12} title="Self-Play & Arenas"
            intro="Heuristics are proven, not assumed. KatGPT pits adaptive intelligence against greedy and static baselines in real game arenas."
          >
            <p>
              <strong>G-Zero</strong> self-play needs no external verifier: a Hint-δ intrinsic reward
              makes modelless heuristic learning smarter, then optionally layers model-based self-play
              (GRPO proposer + length-normalized DPO generator) on top.
            </p>
            <Card title="Bomberman HL Arena — HL thesis proven">
              <Pipeline
                steps={[
                  { label: 'adaptive +177', accent: true },
                  { label: 'greedy +131' },
                  { label: 'static −30' },
                  { label: 'random −55' },
                ]}
              />
              Adaptive intelligence beats greedy, which beats static rules, which beats random — the
              ordering the whole thesis predicts.
            </Card>
            <div className="grid-3">
              <Card title="Monopoly FSM">4-player turn-based FSM AI across 1000 games with bandit adaptation.</Card>
              <Card title="Go — AutoGo">GoState ~1.2µs/move, MCTS ~4,500 sim/s, ~5× faster than Python AutoGo.</Card>
              <Card title="FFT Tactics">TFT party AI in a tactics arena for verifier-free self-play.</Card>
            </div>
          </Section>

          {/* 13 --------------------------------------------------- */}
          <Section
            id="benchmarks" num={13} title="Benchmark Results"
            intro="Apple Silicon, single-threaded, --release, 2000 iterations + 50 warmup, zero-alloc hot paths. Latest run: 2026-05-29, default features."
          >
            <h3>Effective decode throughput (tok/s = steps/s × accept length)</h3>
            <BarChart
              data={[
                { label: 'Speculative (AR Draft)', value: 8008721, unit: 'tok/s', tag: '1.14M steps × 7.0' },
                { label: 'Spec (conditioned)', value: 6302738, unit: 'tok/s', tag: '934K steps × 6.75' },
                { label: 'Speculative (Simulated)', value: 4271405, unit: 'tok/s', tag: '854K steps × 5.0' },
                { label: 'DFlash', value: 3387168, unit: 'tok/s', tag: '423K steps × 8.0' },
                { label: 'Transformer AR', value: 1711230, unit: 'tok/s', tag: '1.71M steps × 1.0' },
                { label: 'Leviathan (Alg 1)', value: 1630214, unit: 'tok/s', tag: '1.63M steps × 1.0' },
              ]}
            />
            <h3>Recurrent attention (ops/s — different unit)</h3>
            <div className="grid-2">
              <Stat num="2.02M" label="forward_raven (16 slots) ops/s — 0.49 µs" />
              <Stat num="22.9M" label="raven_recall ops/s — passkey after 1000 noise, 63.21" tone="blue" />
            </div>
            <Card title="Reading the gain honestly">
              The benchmark harness reports <code className="inline">throughput</code> as{' '}
              <em>verification steps per second</em> (<code className="inline">iters / elapsed</code>) —
              not tokens. Plain AR emits one token per step, so its steps/s and tok/s coincide
              (1.71M). But each speculative step emits multiple accepted tokens, so real decode
              throughput is <span className="kicker">steps/s × avg accept length</span>. Once you
              multiply through, every speculative method beats AR: DFlash drafts 8 tokens/step
              (3.39M tok/s), AR-draft accepts 7.0 (8.0M tok/s). The earlier chart plotted the raw
              steps/s column under a "tok/s" label, which is why AR looked fastest — it wasn't.
            </Card>
          </Section>

          {/* 14 --------------------------------------------------- */}
          <Section
            id="stack" num={14} title="Tech Stack: Research → Code → Proof"
            intro="Every feature is traced from a research paper to an implementation to a benchmark, and labelled honestly — including the ideas that didn't pan out."
          >
            <DataTable
              head={['Feature', 'Status', 'Real gain (from code)']}
              rows={[
                ['LeviathanVerifier', <Badge kind="goat">GOAT</Badge>, 'Always ≥1 token/step, identical distribution. No feature gate.'],
                ['Raven RSM', <Badge kind="goat">GOAT</Badge>, 'O(1) attention: 16 slots regardless of seq_len.'],
                ['SpectralQuant', <Badge kind="goat">GOAT</Badge>, '9.1× compression, cosine 0.9917 vs TQ 5.3× / 0.9692.'],
                ['Hybrid OCT+PQ', <Badge kind="goat">GOAT</Badge>, 'Default KV codec, 64× fewer rotation FMAs.'],
                ['GDN2', <Badge kind="goat">GOAT</Badge>, '14/14. Constant per-head state, 87–98% memory savings.'],
                ['Bandit + HL', <Badge kind="goat">GOAT</Badge>, '+37.5pp survival; pipeline at 1.16M cycles/sec.'],
                ['PlasmaPath', <Badge kind="goat">GOAT</Badge>, '5/5. Ternary {−1,0,+1} at 1.58 bits/weight → 20× less memory traffic (0.70× FP32 NEON speed — a memory win, not a compute win).'],
                ['Sigmoid Margin', <Badge kind="goat">GOAT</Badge>, '7/7. Optimal retrieval margin at d=Θ(k·log n); sigmoid reaches it at d≈log n vs InfoNCE Θ(n^⅓). No MaxSim regression.'],
                ['MoA Inference', <Badge kind="goat">GOAT</Badge>, '10/10. Token-adaptive SwiGLU; expressivity fixed⊊LA⊊MoA; O(28d)≪O(d²), 1.03–1.13× wall-clock.'],
                ['G-Zero self-play', <Badge kind="gated">gated</Badge>, '8.57M δ/sec; bench-only, never touches forward().'],
                ['Percepta transformer-VM', <Badge kind="gated">gated</Badge>, 'Full RIIR: CHT hull O(log h), WASM interpreter, MILP.'],
                ['TurboQuant', <Badge kind="dead">legacy</Badge>, 'Demoted — SpectralQuant / OCTOPUS dominate.'],
                ['StepCode reward shaping', <Badge kind="dead">no gain</Badge>, 'Correct math, but gains need a trained 7B model.'],
                ['δ-Mem', <Badge kind="dead">no gain</Badge>, 'Converges, but 26× latency; corrections too small.'],
              ]}
            />
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>
              <Badge kind="goat">GOAT</Badge> = default-on, production-proven ·{' '}
              <Badge kind="gated">gated</Badge> = opt-in, proven ·{' '}
              <Badge kind="dead">legacy / no gain</Badge> = kept for comparison or honestly retired.
            </p>

            <h3>Newest GOAT picks (Plans 148–158)</h3>
            <div className="grid-3">
              <Card title="PlasmaPath · Bench 044">
                Ternary weights {'{−1,0,+1}'} at <strong>1.58 bits/weight</strong>, branchless SIMD
                add/sub — no multiply. SIMD↔scalar checksum {'<'} 0.1‰. <strong>Honest:</strong> at
                7.57 Gop/s it is 0.70× of FP32 NEON — the win is <strong>20× less memory traffic</strong>,
                not raw speed. <span className="kicker">5/5</span>.
              </Card>
              <Card title="Sigmoid Margin · Bench 048">
                Proves optimal retrieval margin needs only <code className="inline">d = Θ(k·log n)</code>{' '}
                (tight). SigLIP sigmoid loss reaches positive margin at d≈log n vs InfoNCE's Θ(n^⅓)
                (k=2: d≈6→9 vs 10→23). No MaxSim regression. <span className="kicker">7/7</span>.
              </Card>
              <Card title="MoA Inference · Bench 049">
                Token-adaptive bi-MoA SwiGLU (try the mixer in chapter 04). Expressivity hierarchy
                <code className="inline"> fixed ⊊ LA ⊊ MoA</code>, sigmoid gate {'>'} softmax,
                1.03–1.13× wall-clock, memory unchanged. <span className="kicker">10/10</span>.
              </Card>
            </div>
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>
              Each traces research → code → proof: a <code className="inline">.research/</code> paper
              summary, an implementation under a feature gate, and a <code className="inline">.benchmarks/</code>{' '}
              GOAT certificate. The MoA proof also caught a sign error in its own test reference —
              fixed, not papered over.
            </p>
          </Section>

          {/* 15 --------------------------------------------------- */}
          <Section
            id="together" num={15} title="Putting It All Together"
            intro="A single token's journey through the whole machine."
          >
            <ArchitectureDemo />
            <p>
              Text becomes tokens. Tokens become vectors. The vectors move through a single
              transformer layer — but every step is shadowed by a draft tree, screened by a rules
              engine, verified without changing the distribution, and remembered in O(1). A bandit
              watches the whole thing and learns how hard to think next time. That is the anatomy of
              KatGPT-RS: a small model made formidable by the structure around it.
            </p>
            <div className="grid-3">
              <Stat num="740+" label="tests across the workspace" />
              <Stat num="3.6M" label="tok/s on Apple M-series" tone="green" />
              <Stat num="100%" label="invalid branches pruned (Sudoku)" tone="blue" />
            </div>
          </Section>

          {/* 16 --------------------------------------------------- */}
          <Section
            id="percepta" num={16} title="Percepta — A Transformer That Executes Programs"
            intro="Going further: the same machinery that decodes language can be compiled into a CPU. Percepta's transformer-vm, reimplemented in pure Rust, runs a transformer as a program interpreter — with O(log N) attention."
          >
            <PerceptaVMDemo />
            <p>
              The build phase happens once: gate primitives (ReGLU, persist) form a computation
              graph, a MILP scheduler packs them into the fewest layers (minimizing{' '}
              <code className="inline">d_model</code>), and the graph compiles down to transformer
              weights. At inference, a C or Rust program lowers to WASM bytecode — one byte per token —
              and the transformer executes it step by step, with the <strong>HullKVCache</strong>{' '}
              replacing brute-force attention by O(log N) convex-hull queries.
            </p>
            <div className="grid-3">
              <Stat num="O(log N)" label="hull attention vs brute O(N)" tone="green" />
              <Stat num="d = 2" label="attention head → 2D geometric projection" tone="blue" />
              <Stat num="1 byte" label="= 1 token of machine state" />
            </div>

            <h3>Original vs. our Rust port</h3>
            <p style={{ fontSize: 14, color: 'var(--faint)', marginTop: 0 }}>
              Percepta's <code className="inline">transformer-vm</code> is Python + PyTorch with a
              standalone C++ inference engine. We reimplemented the whole pipeline in pure Rust —
              same algorithm, no Python/torch/C++ at runtime.
            </p>
            <DataTable
              head={['Dimension', 'Percepta transformer-vm', 'KatGPT-RS percepta (Rust)']}
              rows={[
                ['Language / runtime', 'Python 3.11 + PyTorch + C++17 engine (BLAS, pybind11)', 'Pure Rust — no Python, torch, or C++'],
                ['Build pipeline', 'Python (numpy): graph → schedule → weights', 'Rust: graph/ → scheduler.rs → weights.rs'],
                ['Inference engine', 'standalone transformer.cpp (BLAS)', 'transformer.rs (pure Rust)'],
                ['MILP scheduler', 'PuLP → HiGHS (CBC fallback)', 'good_lp → HiGHS (MIT), 30 s cap'],
                ['Hull KV cache', 'CHT in C++ (hull2d_cht.h) via pybind11', 'CHT in Rust (cht.rs / hull.rs), f64'],
                ['Attention', 'O(log n) hull + brute fallback', 'O(log N) hull + BruteAttentionHead ref'],
                ['Program input', 'C → WASM (clang)', 'C → WASM (clang) · also Rust src + raw .wasm'],
                ['Specialization', 'specialize.py (Futamura)', 'specialize.rs (Futamura)'],
                ['Dependencies', 'numpy, torch, pulp, LLVM/clang, C++17, uv', 'one crate (+ good_lp/highs), gated --features percepta'],
                ['License', 'Apache-2.0', 'MIT (distilled, attributed)'],
                ['Throughput', '~30K tok/s (C++ BLAS engine)', <span>fair head-to-head pending <Badge kind="gated">Plan 064</Badge></span>],
              ]}
            />
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>
              Honest note: the throughput numbers aren't comparable yet — the existing{' '}
              <code className="inline">examples/sudoku_04_percepta_vs.rs</code> pits our Rust hull
              backtracker against their WASM-executing transformer (different algorithms). The
              apples-to-apples run — same algorithm, same machine, Rust vs C++ — lands with Plan 064.
            </p>
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>
              This is also the bridge between a language model and a verifier: encode rules as 2D keys
              and the transformer can <em>check</em> as well as generate.
            </p>
          </Section>

          {/* 17 --------------------------------------------------- */}
          <Section
            id="sudoku" num={17} title="Watch It Solve — Live in Your Browser"
            intro="The real Rust solver, compiled to WebAssembly and running right here. Same engine as examples/sudoku_04_percepta_vs.rs — a backtracking solver whose execution trace feeds the O(log N) convex-hull cache. Pick an engine and watch it think."
          >
            <SudokuDemo />
          </Section>

          <div className="footer">
            <p>
              Built with React + Vite. Content mirrors the{' '}
              <a href="https://github.com/katopz/katgpt-rs">KatGPT-RS</a> README, structured after
              Roy van Rijn's <a href="https://www.royvanrijn.com/anatomy-of-an-llm/">Anatomy of an LLM</a>.
            </p>
            <p>
              References: <a href="https://arxiv.org/pdf/2211.17192">Speculative Decoding (Leviathan 2022)</a> ·{' '}
              <a href="https://github.com/goombalab/raven">Raven</a> ·{' '}
              <a href="https://arxiv.org/abs/2605.09959">G-Zero</a> ·{' '}
              <a href="https://www.percepta.ai/blog/can-llms-be-computers">Percepta</a>
            </p>
          </div>
        </main>
      </div>
    </>
  )
}
