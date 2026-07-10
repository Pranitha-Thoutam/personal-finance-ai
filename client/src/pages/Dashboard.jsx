import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTransactions } from "../api/transactionService";

/* ─────────────────────────────────────────────
   ICONS
───────────────────────────────────────────── */
const WalletIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="16" height="12" rx="2" />
    <path d="M2 9h16" />
    <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 14V6M6 10l4-4 4 4" />
  </svg>
);
const ArrowDownIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 6v8M6 10l4 4 4-4" />
  </svg>
);
const SavingsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 8A5 5 0 1 0 5 8v1H3.5a.5.5 0 0 0-.5.5V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5a.5.5 0 0 0-.5-.5H15V8z" />
    <path d="M10 12v-1.5M7 14h6" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10h8M11 7l3 3-3 3" />
  </svg>
);
const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    <path d="M5 3l.8 2.7L8.5 6.5l-2.7.8L5 10l-.8-2.7L1.5 6.5l2.7-.8L5 3z" />
  </svg>
);

/* ─────────────────────────────────────────────
   CATEGORY META
───────────────────────────────────────────── */
const CATEGORY_META = {
  Food:          { emoji: "🍜", iconClass: "food"      },
  Transport:     { emoji: "🚗", iconClass: "transport" },
  Shopping:      { emoji: "🛍️",  iconClass: "shopping"  },
  Health:        { emoji: "💊", iconClass: "health"    },
  Bills:         { emoji: "⚡", iconClass: "bills"     },
  Entertainment: { emoji: "🎬", iconClass: "entertain" },
  Housing:       { emoji: "🏠", iconClass: "housing"   },
  Education:     { emoji: "📚", iconClass: "education" },
  Salary:        { emoji: "💰", iconClass: "salary"    },
  Freelance:     { emoji: "💼", iconClass: "salary"    },
  Investment:    { emoji: "📈", iconClass: "health"    },
  Bonus:         { emoji: "🎁", iconClass: "salary"    },
  Other:         { emoji: "📌", iconClass: "food"      },
};

function getCategoryMeta(cat) {
  return CATEGORY_META[cat] || { emoji: "📂", iconClass: "food" };
}

const CATEGORY_COLORS = [
  "#3d8c6e", "#d4895a", "#4a7fd4", "#b45a9e",
  "#6b5dd4", "#e0875a", "#1d9e75", "#a1a9b4",
];
const CATEGORY_COLOR_MAP = {
  Housing: "#3d8c6e", Food: "#d4895a", Transport: "#4a7fd4",
  Shopping: "#b45a9e", Health: "#3d8c6e", Bills: "#6b5dd4",
  Entertainment: "#e0875a", Other: "#a1a9b4",
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function fmt(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  const diffDays = Math.floor((new Date() - d) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Build last-6-months data with REAL amounts (not normalised).
 */
function buildLineData(transactions) {
  const map = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = d.toLocaleDateString("en-IN", { month: "short" });
    const sortKey = d.getFullYear() * 100 + d.getMonth();
    if (!map[key]) map[key] = { month: key, income: 0, expenses: 0, _sort: sortKey };
    if (t.type === "income")  map[key].income   += t.amount;
    if (t.type === "expense") map[key].expenses += t.amount;
  });
  return Object.values(map)
    .sort((a, b) => a._sort - b._sort)
    .slice(-6)
    .map(({ _sort, ...rest }) => rest);
}

/**
 * Build category spend for current month — top 6.
 */
function buildDonutData(transactions) {
  const month = thisMonth();
  const map = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key !== month || t.type !== "expense") return;
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount], i) => ({
      name,
      amount,
      pct:   Math.round((amount / total) * 100),
      color: CATEGORY_COLOR_MAP[name] || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
}

/* ─────────────────────────────────────────────
   SVG LINE CHART
   Pure SVG — smooth cubic bezier lines, dots,
   x-axis labels, y-axis gridlines.
───────────────────────────────────────────── */
function LineChart({ data, loading }) {
  const W = 100;  // % width, SVG uses viewBox
  const H = 160;
  const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
  const chartW = 560 - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (loading) {
    return (
      <div className="dash-line-skeleton">
        <div className="dash-skeleton" style={{ width: "100%", height: H, borderRadius: 8 }} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="dash-chart-empty"><p>No transaction data yet.</p></div>;
  }

  const allVals = data.flatMap(d => [d.income, d.expenses]);
  const maxVal  = Math.max(...allVals, 1);
  const minVal  = 0;
  const range   = maxVal - minVal || 1;

  // Map value → y coordinate
  const yPos = v => PAD.top + chartH - ((v - minVal) / range) * chartH;
  // Map index → x coordinate
  const xPos = i => PAD.left + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);

  // Smooth bezier path from points
  function smoothPath(points) {
    if (points.length === 0) return "";
    if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX  = (prev[0] + curr[0]) / 2;
      d += ` C${cpX},${prev[1]} ${cpX},${curr[1]} ${curr[0]},${curr[1]}`;
    }
    return d;
  }

  // Area fill path (close back to baseline)
  function areaPath(points, baseline) {
    if (points.length === 0) return "";
    const line = smoothPath(points);
    return `${line} L${points[points.length - 1][0]},${baseline} L${points[0][0]},${baseline} Z`;
  }

  const incomePoints  = data.map((d, i) => [xPos(i), yPos(d.income)]);
  const expensePoints = data.map((d, i) => [xPos(i), yPos(d.expenses)]);
  const baseline      = yPos(0);

  // Y axis grid lines (3 levels)
  const gridVals = [0, Math.round(maxVal * 0.5), maxVal];

  function fmtAxis(v) {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
  }

  // Tooltip state
  const [hovered, setHovered] = React.useState(null);
  const dotR  = 3.5;
  const hitW  = chartW / Math.max(data.length - 1, 1);

  return (
    <div className="dash-line-wrap">
      <svg
        viewBox={`0 0 560 ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3d8c6e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3d8c6e" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#d4895a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d4895a" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={yPos(v)}
              x2={PAD.left + chartW} y2={yPos(v)}
              stroke="var(--border-soft, #e8e4de)"
              strokeWidth="0.5"
              strokeDasharray={v === 0 ? "none" : "3 3"}
            />
            <text
              x={PAD.left - 6} y={yPos(v)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="9"
              fill="var(--text-muted, #a1a9b4)"
              fontFamily="var(--font-body, sans-serif)"
            >
              {fmtAxis(v)}
            </text>
          </g>
        ))}

        {/* Area fills */}
        <path d={areaPath(incomePoints, baseline)}  fill="url(#incomeGrad)"  />
        <path d={areaPath(expensePoints, baseline)} fill="url(#expenseGrad)" />

        {/* Lines */}
        <path
          d={smoothPath(incomePoints)}
          fill="none"
          stroke="#3d8c6e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={smoothPath(expensePoints)}
          fill="none"
          stroke="#d4895a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover hit areas + vertical rule */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={xPos(i) - hitW / 2}
            y={PAD.top}
            width={hitW}
            height={chartH}
            fill="transparent"
            style={{ cursor: "default" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {/* Hover rule */}
        {hovered !== null && (
          <line
            x1={xPos(hovered)} y1={PAD.top}
            x2={xPos(hovered)} y2={PAD.top + chartH}
            stroke="var(--border-soft, #e8e4de)"
            strokeWidth="1"
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}

        {/* Dots */}
        {data.map((d, i) => (
          <g key={i} pointerEvents="none">
            <circle cx={xPos(i)} cy={yPos(d.income)} r={hovered === i ? dotR + 1.5 : dotR}
              fill="#3d8c6e" stroke="#fff" strokeWidth="1.5" />
            <circle cx={xPos(i)} cy={yPos(d.expenses)} r={hovered === i ? dotR + 1.5 : dotR}
              fill="#d4895a" stroke="#fff" strokeWidth="1.5" />
          </g>
        ))}

        {/* Tooltip */}
        {hovered !== null && (() => {
          const d  = data[hovered];
          const x  = xPos(hovered);
          const bw = 110;
          const bh = 52;
          const bx = Math.min(Math.max(x - bw / 2, PAD.left), PAD.left + chartW - bw);
          const by = PAD.top;
          return (
            <g pointerEvents="none">
              <rect x={bx} y={by} width={bw} height={bh} rx="6"
                fill="var(--bg-sidebar, #1c1f26)" opacity="0.92" />
              <text x={bx + bw / 2} y={by + 13} textAnchor="middle"
                fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.5)"
                fontFamily="var(--font-body, sans-serif)">
                {d.month.toUpperCase()}
              </text>
              <circle cx={bx + 10} cy={by + 28} r="3" fill="#3d8c6e" />
              <text x={bx + 17} y={by + 28} dominantBaseline="central"
                fontSize="9" fill="rgba(255,255,255,0.85)"
                fontFamily="var(--font-body, sans-serif)">
                {fmt(d.income)}
              </text>
              <circle cx={bx + 10} cy={by + 42} r="3" fill="#d4895a" />
              <text x={bx + 17} y={by + 42} dominantBaseline="central"
                fontSize="9" fill="rgba(255,255,255,0.85)"
                fontFamily="var(--font-body, sans-serif)">
                {fmt(d.expenses)}
              </text>
            </g>
          );
        })()}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xPos(i)} y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-muted, #a1a9b4)"
            fontFamily="var(--font-body, sans-serif)"
          >
            {d.month}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SVG DONUT CHART
   Clean donut with centered total, legend list.
───────────────────────────────────────────── */
function DonutChart({ data, loading, totalExpense }) {
  const [hovered, setHovered] = React.useState(null);
  const R = 54;       // outer radius
  const r = 33;       // inner radius (hole)
  const CX = 80;
  const CY = 80;
  const SIZE = 160;

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div className="dash-skeleton" style={{ width: SIZE, height: SIZE, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 12, borderRadius: 6, width: `${70 + i * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="dash-chart-empty"><p>No expenses this month.</p></div>;
  }

  // Build arc segments
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;
  let startAngle = -Math.PI / 2;

  function polarToXY(angle, radius) {
    return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
  }

  function arcPath(start, end, outerR, innerR) {
    const large = (end - start) > Math.PI ? 1 : 0;
    const [ox1, oy1] = polarToXY(start, outerR);
    const [ox2, oy2] = polarToXY(end,   outerR);
    const [ix1, iy1] = polarToXY(end,   innerR);
    const [ix2, iy2] = polarToXY(start, innerR);
    return `M${ox1},${oy1} A${outerR},${outerR} 0 ${large} 1 ${ox2},${oy2} L${ix1},${iy1} A${innerR},${innerR} 0 ${large} 0 ${ix2},${iy2} Z`;
  }

  const segments = data.map((d, i) => {
    const sweep = (d.amount / total) * 2 * Math.PI;
    const end   = startAngle + sweep;
    const seg   = { ...d, startAngle, endAngle: end, index: i };
    startAngle  = end;
    return seg;
  });

  return (
    <div className="dash-donut-layout">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: SIZE, height: SIZE, flexShrink: 0 }}>
        {segments.map((s, i) => {
          const isHov  = hovered === i;
          const outerR = isHov ? R + 4 : R;
          return (
            <path
              key={s.name}
              d={arcPath(s.startAngle, s.endAngle, outerR, r)}
              fill={s.color}
              opacity={hovered !== null && !isHov ? 0.45 : 1}
              style={{ transition: "all 0.18s ease", cursor: "default" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        {/* Gap between segments */}
        <circle cx={CX} cy={CY} r={r} fill="var(--bg-card, #fff)" />
        {/* Centre label */}
        {hovered !== null ? (
          <>
            <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="central"
              fontSize="9" fill="var(--text-muted, #a1a9b4)"
              fontFamily="var(--font-body, sans-serif)">
              {segments[hovered].name}
            </text>
            <text x={CX} y={CY + 9} textAnchor="middle" dominantBaseline="central"
              fontSize="11" fontWeight="600" fill="var(--text-primary, #1c1f26)"
              fontFamily="var(--font-body, sans-serif)">
              {segments[hovered].pct}%
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY - 6} textAnchor="middle" dominantBaseline="central"
              fontSize="8.5" fill="var(--text-muted, #a1a9b4)"
              fontFamily="var(--font-body, sans-serif)">
              total
            </text>
            <text x={CX} y={CY + 8} textAnchor="middle" dominantBaseline="central"
              fontSize="10" fontWeight="600" fill="var(--text-primary, #1c1f26)"
              fontFamily="var(--font-body, sans-serif)">
              {fmt(totalExpense)}
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="dash-donut-legend">
        {data.map((d, i) => (
          <div
            key={d.name}
            className={`dash-donut-item${hovered === i ? " hovered" : ""}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="dash-donut-dot" style={{ background: d.color }} />
            <span className="dash-donut-name">{d.name}</span>
            <span className="dash-donut-pct" style={{ color: d.color }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────── */
function Skeleton({ w = "100%", h = 14, style = {} }) {
  return (
    <div
      className="dash-skeleton"
      style={{ width: w, height: h, borderRadius: 6, display: "block", ...style }}
    />
  );
}

/* ═════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchTransactions();
      setTransactions(res.data.data ?? []);
    } catch (err) {
      setError(err.userMessage || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Computed ── */
  const totalIncome  = transactions.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;
  const savingsRate  = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  const month = thisMonth();
  const monthTxns    = transactions.filter(t => {
    const d = new Date(t.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === month;
  });
  const monthIncome  = monthTxns.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const recentTxns  = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const lineData    = buildLineData(transactions);
  const donutData   = buildDonutData(transactions);
  const monthExpenseTotal = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const STATS = [
    {
      id: 1, label: "Total Balance",
      value: fmt(balance),
      change: balance >= 0 ? `+${savingsRate}% savings rate` : "Expenses exceed income",
      changeType: balance >= 0 ? "up" : "down",
      Icon: WalletIcon, iconClass: "green",
    },
    {
      id: 2, label: "Total Income",
      value: fmt(totalIncome),
      change: `${fmt(monthIncome)} this month`,
      changeType: "up",
      Icon: ArrowUpIcon, iconClass: "green",
    },
    {
      id: 3, label: "Total Expenses",
      value: fmt(totalExpense),
      change: `${fmt(monthExpense)} this month`,
      changeType: monthExpense > 0 ? "down" : "neutral",
      Icon: ArrowDownIcon, iconClass: "warm",
    },
    {
      id: 4, label: "Savings",
      value: fmt(Math.max(0, balance)),
      change: `${savingsRate}% of income`,
      changeType: savingsRate >= 20 ? "up" : savingsRate > 0 ? "neutral" : "down",
      Icon: SavingsIcon, iconClass: "blue",
    },
  ];

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="dash-error-banner">
          <span>⚠ {error}</span>
          <button onClick={() => setError("")} className="dash-error-close">✕</button>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="stats-grid">
        {STATS.map(({ id, label, value, change, changeType, Icon, iconClass }) => (
          <div key={id} className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">{label}</span>
              <div className={`stat-icon ${iconClass}`}>
                {loading ? null : <Icon />}
              </div>
            </div>
            {loading ? (
              <>
                <Skeleton w={110} h={28} style={{ marginBottom: 10 }} />
                <Skeleton w={90}  h={22} />
              </>
            ) : (
              <>
                <div className="stat-value">{value}</div>
                <span className={`stat-change ${changeType}`}>
                  {changeType === "up" ? "↑" : changeType === "down" ? "↓" : "·"} {change}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Middle Row: Line chart + Donut chart ── */}
      <div className="middle-row">

        {/* LINE CHART */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Income vs Expenses</span>
            <span className="section-link">Last 6 months</span>
          </div>

          <LineChart data={lineData} loading={loading} />

          <div className="chart-legend" style={{ marginTop: 10 }}>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "#3d8c6e" }} />
              <span>Income</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "#d4895a" }} />
              <span>Expenses</span>
            </div>
          </div>
        </div>

        {/* DONUT CHART */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Spending by Category</span>
            <span
              className="section-link"
              onClick={() => navigate("/budget")}
              style={{ cursor: "pointer" }}
            >
              View all →
            </span>
          </div>

          <DonutChart data={donutData} loading={loading} totalExpense={monthExpenseTotal} />
        </div>
      </div>

      {/* ── Bottom Row: Recent Transactions + Overview ── */}
      <div className="bottom-row">

        {/* Recent Transactions — scrollable */}
        <div className="card dash-scroll-card">
          <div className="section-header">
            <span className="section-title">Recent Transactions</span>
            <span
              className="section-link"
              onClick={() => navigate("/transactions")}
              style={{ cursor: "pointer" }}
            >
              See all →
            </span>
          </div>

          <div className="txn-list dash-scroll-body">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="txn-item">
                  <Skeleton w={38} h={38} style={{ borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <Skeleton w={100} h={12} />
                    <Skeleton w={70}  h={10} />
                  </div>
                  <Skeleton w={60} h={12} />
                </div>
              ))
            ) : recentTxns.length === 0 ? (
              <div className="dash-chart-empty">
                <p>No transactions yet. <span className="dash-link" onClick={() => navigate("/transactions")}>Add one →</span></p>
              </div>
            ) : (
              recentTxns.map(t => {
                const meta = getCategoryMeta(t.category);
                const isIn = t.type === "income";
                return (
                  <div key={t._id || t.id} className="txn-item">
                    <div className={`txn-icon ${meta.iconClass}`}>{meta.emoji}</div>
                    <div className="txn-info">
                      <div className="txn-name">{t.note || t.category}</div>
                      <div className="txn-date">{fmtDate(t.date)} · {t.category}</div>
                    </div>
                    <div className={`txn-amount ${isIn ? "credit" : "debit"}`}>
                      {isIn ? "+" : "−"}{fmt(t.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Overview — scrollable */}
        <div className="card dash-scroll-card">
          <div className="section-header">
            <span className="section-title">Overview</span>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <Skeleton w={90} h={13} />
                  <Skeleton w={70} h={13} />
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-overview-list dash-scroll-body">
              {[
                { label: "Total Transactions",   value: transactions.length },
                { label: "This Month Income",     value: fmt(monthIncome), highlight: true },
                { label: "This Month Expense",    value: fmt(monthExpense), highlight: false },
                { label: "Net This Month",        value: fmt(monthIncome - monthExpense), highlight: (monthIncome - monthExpense) >= 0 },
                { label: "Overall Savings Rate",  value: `${savingsRate}%`, highlight: savingsRate >= 20 },
                { label: "Categories Tracked",    value: [...new Set(transactions.map(t => t.category))].length },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="dash-overview-row">
                  <span className="dash-overview-label">{label}</span>
                  <span
                    className="dash-overview-value"
                    style={
                      highlight === true  ? { color: "var(--accent-primary)", fontWeight: 600 } :
                      highlight === false ? { color: "var(--accent-warm)",    fontWeight: 600 } : {}
                    }
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Card ── */}
      <div className="ai-card" onClick={() => navigate("/ai")} style={{ cursor: "pointer" }}>
        <div className="ai-icon-wrap"><SparkleIcon /></div>
        <div className="ai-text">
          <h3>Ask your AI Financial Advisor</h3>
          <p>Get personalised insights, spending tips, and savings goals — based on your actual data.</p>
        </div>
        <div className="ai-arrow"><ArrowRightIcon /></div>
      </div>
    </>
  );
}
