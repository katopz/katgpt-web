// Small presentational building blocks shared across chapters.

export function Stat({ num, label, tone }) {
  return (
    <div className="stat">
      <div className={`num ${tone || ''}`}>{num}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export function Card({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  )
}

export function Code({ children }) {
  return <pre className="code">{children}</pre>
}

export function Pipeline({ steps }) {
  return (
    <div className="flow">
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className={`node ${s.accent ? 'accent' : ''}`}>{s.label}</span>
          {i < steps.length - 1 && <span className="arrow">→</span>}
        </span>
      ))}
    </div>
  )
}

export function DataTable({ head, rows }) {
  return (
    <div className="tbl-wrap">
      <table className="data">
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Badge({ kind, children }) {
  return <span className={`badge ${kind}`}>{children}</span>
}
