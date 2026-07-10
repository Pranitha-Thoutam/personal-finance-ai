import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import { fetchTransactions } from "../api/transactionService";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CATEGORY_COLORS = {
  Housing:       "#3d8c6e",
  Food:          "#d4895a",
  Transport:     "#4a7fd4",
  Bills:         "#6b5dd4",
  Health:        "#6bbf9a",
  Shopping:      "#b45a9e",
  Entertainment: "#e0875a",
  Education:     "#4a7fd4",
  Investment:    "#1d9e75",
  Other:         "#a1a9b4",
};

const PALETTE = [
  "#3d8c6e","#d4895a","#4a7fd4","#b45a9e",
  "#6bbf9a","#6b5dd4","#e0875a","#1d9e75","#a1a9b4","#c0735a",
];

function getCategoryColor(name, index) {
  return CATEGORY_COLORS[name] || PALETTE[index % PALETTE.length];
}

function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000)   return "₹" + (n / 1000).toFixed(1)   + "k";
  return "₹" + Math.round(n);
}

function fmtFull(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

/* ─────────────────────────────────────────────
   DATA PROCESSING HELPERS
───────────────────────────────────────────── */

/** Group transactions by "MMM YY" → { income, expense } totals */
function buildMonthlyData(transactions) {
  const map = {};

  transactions.forEach(t => {
    const d    = new Date(t.date);
    const key  = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const sort = d.getFullYear() * 100 + d.getMonth(); // for ordering
    if (!map[key]) map[key] = { month: key, income: 0, expense: 0, _sort: sort };
    if (t.type === "income")  map[key].income  += t.amount;
    if (t.type === "expense") map[key].expense += t.amount;
  });

  return Object.values(map)
    .sort((a, b) => a._sort - b._sort)
    .map(({ _sort, ...rest }) => ({ ...rest, savings: Math.max(0, rest.income - rest.expense) }));
}

/** Group expense transactions by category → [{ name, value, color }] */
function buildCategoryData(transactions) {
  const map = {};
  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: getCategoryColor(name, i) }));
}

/** Compute KPI summary from all transactions */
function buildKpis(transactions) {
  const monthlyMap = buildMonthlyData(transactions);
  if (!monthlyMap.length) return null;

  const totalIncome  = monthlyMap.reduce((s, m) => s + m.income,  0);
  const totalExpense = monthlyMap.reduce((s, m) => s + m.expense, 0);
  const count        = monthlyMap.length;

  const avgIncome   = totalIncome  / count;
  const avgExpense  = totalExpense / count;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  // Best savings month
  const bestMonth = [...monthlyMap].sort((a, b) => b.savings - a.savings)[0];

  return { avgIncome, avgExpense, savingsRate, bestMonth };
}

/** Generate smart insights from processed data */
function buildInsights(monthlyData, categoryData, kpis) {
  const insights = [];
  if (!kpis || !monthlyData.length) return insights;

  const last   = monthlyData[monthlyData.length - 1];
  const prev   = monthlyData[monthlyData.length - 2];

  // Expense trend
  if (prev && last) {
    const diff = prev.expense > 0 ? Math.round(((last.expense - prev.expense) / prev.expense) * 100) : 0;
    if (diff < 0) {
      insights.push({ icon: "📉", title: `Expenses down ${Math.abs(diff)}%`, desc: `Spending dropped vs last month. Great discipline!`, positive: true });
    } else if (diff > 0) {
      insights.push({ icon: "📈", title: `Expenses up ${diff}%`, desc: `Spending increased vs last month. Review discretionary spend.`, positive: false });
    }
  }

  // Top category
  if (categoryData.length) {
    const top   = categoryData[0];
    const total = categoryData.reduce((s, c) => s + c.value, 0);
    const pct   = total > 0 ? Math.round((top.value / total) * 100) : 0;
    insights.push({ icon: "💡", title: `Top spend: ${top.name}`, desc: `${top.name} takes ${pct}% of your expenses (${fmtFull(top.value)}).`, positive: null });
  }

  // Savings rate
  if (kpis.savingsRate >= 20) {
    insights.push({ icon: "🎯", title: `Savings rate: ${kpis.savingsRate}%`, desc: `You're saving ${kpis.savingsRate}% of income. Keep it up!`, positive: true });
  } else if (kpis.savingsRate >= 0) {
    insights.push({ icon: "⚠️", title: `Low savings rate: ${kpis.savingsRate}%`, desc: `Try to save at least 20% of income each month.`, positive: false });
  }

  // Income vs expense health
  if (last) {
    if (last.income > last.expense) {
      insights.push({ icon: "✅", title: "Positive cash flow", desc: `You earned ${fmtFull(last.income - last.expense)} more than you spent this month.`, positive: true });
    } else if (last.expense > last.income) {
      insights.push({ icon: "🚨", title: "Negative cash flow", desc: `Spending exceeded income by ${fmtFull(last.expense - last.income)} this month.`, positive: false });
    }
  }

  return insights.slice(0, 4);
}

/* ─────────────────────────────────────────────
   CUSTOM TOOLTIP COMPONENTS
───────────────────────────────────────────── */
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <p className="an-tooltip-label">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="an-tooltip-row">
          <span className="an-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}: <strong>{fmtFull(p.value)}</strong></span>
        </div>
      ))}
    </div>
  );
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <p className="an-tooltip-label">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="an-tooltip-row">
          <span className="an-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}: <strong>{fmtFull(p.value)}</strong></span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: inner } = payload[0];
  return (
    <div className="an-tooltip">
      <div className="an-tooltip-row">
        <span className="an-tooltip-dot" style={{ background: inner.color }} />
        <span>{name}: <strong>{fmtFull(value)}</strong></span>
      </div>
    </div>
  );
}

/* Custom pie label */
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-body)" }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ─────────────────────────────────────────────
   SMALL UI HELPERS
───────────────────────────────────────────── */
function Skeleton({ w = "100%", h = 14, style = {} }) {
  return <div className="an-skeleton" style={{ width: w, height: h, borderRadius: 6, ...style }} />;
}

function ChartSkeleton({ height = 220 }) {
  return (
    <div className="an-chart-skeleton" style={{ height }}>
      <Skeleton w="100%" h="100%" style={{ borderRadius: 10 }} />
    </div>
  );
}

function EmptyChart({ height = 220, message = "No data yet" }) {
  return (
    <div className="an-chart-empty" style={{ height }}>
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
        <circle cx="24" cy="24" r="20" /><path d="M24 16v8M24 30v2" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

const PERIODS = ["3M", "6M", "1Y", "All"];

/* ═════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════ */
export default function Analytics() {
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [apiError,     setApiError]     = useState("");
  const [period,       setPeriod]       = useState("6M");

  /* ── Fetch ── */
  const load = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetchTransactions();
      setTransactions(res.data.data ?? []);
    } catch (err) {
      setApiError(err.userMessage || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Period filter ── */
  const periodFiltered = (() => {
    if (period === "All") return transactions;
    const now    = new Date();
    const months = period === "3M" ? 3 : period === "6M" ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    return transactions.filter(t => new Date(t.date) >= cutoff);
  })();

  /* ── Processed data ── */
  const monthlyData  = buildMonthlyData(periodFiltered);
  const categoryData = buildCategoryData(periodFiltered);
  const kpis         = buildKpis(periodFiltered);
  const insights     = buildInsights(monthlyData, categoryData, kpis);

  const totalExpense = categoryData.reduce((s, c) => s + c.value, 0);

  /* ── KPI display values ── */
  const kpiCards = kpis ? [
    { label: "Avg Monthly Income",   value: fmtFull(Math.round(kpis.avgIncome)),  change: "per month", up: null },
    { label: "Avg Monthly Expenses", value: fmtFull(Math.round(kpis.avgExpense)), change: "per month", up: null },
    { label: "Best Savings Month",   value: kpis.bestMonth?.month ?? "—",         change: kpis.bestMonth ? fmtFull(kpis.bestMonth.savings) + " saved" : "no data", up: true },
    { label: "Savings Rate",         value: `${kpis.savingsRate}%`,               change: kpis.savingsRate >= 20 ? "healthy" : "below target", up: kpis.savingsRate >= 20 },
  ] : [];

  /* ── Y-axis tick formatter ── */
  const yFmt = (v) => fmt(v);

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="an-root">

      {/* Error banner */}
      {apiError && (
        <div className="an-error-banner">
          <span>⚠ {apiError}</span>
          <button onClick={() => setApiError("")} className="an-error-close">✕</button>
        </div>
      )}

      {/* ── KPI STRIP ── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton w={80} h={11} style={{ marginBottom: 14 }} />
              <Skeleton w={110} h={26} style={{ marginBottom: 10 }} />
              <Skeleton w={70}  h={11} />
            </div>
          ))
        ) : kpiCards.map(({ label, value, change, up }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">{label}</span>
            </div>
            <div className="stat-value" style={{ fontSize: 22 }}>{value}</div>
            <span className={`stat-change ${up === true ? "up" : up === false ? "down" : "neutral"}`}>
              {change}
            </span>
          </div>
        ))}
      </div>

      {/* ── Period selector ── */}
      <div className="an-period-row">
        <div className="period-tabs">
          {PERIODS.map(p => (
            <button key={p} className={`period-tab${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
        <span className="an-period-hint">
          {loading ? "" : `${periodFiltered.length} transactions`}
        </span>
      </div>

      {/* ── ROW 1: Bar chart + Pie chart ── */}
      <div className="an-grid-2">

        {/* Monthly Expenses Bar Chart */}
        <div className="card an-chart-card">
          <div className="section-header" style={{ marginBottom: 20 }}>
            <span className="section-title">Monthly Expenses</span>
          </div>
          {loading ? <ChartSkeleton height={240} /> : monthlyData.length === 0 ? (
            <EmptyChart height={240} message="No expense data for this period" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barCategoryGap="30%" barGap={3}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a1a9b4", fontFamily: "var(--font-body)" }}
                  axisLine={false} tickLine={false} />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11, fill: "#a1a9b4", fontFamily: "var(--font-body)" }}
                  axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)", paddingTop: 12 }} />
                <Bar dataKey="expense" name="Expense" fill="#d4895a" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Bar dataKey="income"  name="Income"  fill="#3d8c6e" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Pie Chart */}
        <div className="card an-chart-card">
          <div className="section-header" style={{ marginBottom: 20 }}>
            <span className="section-title">Spending by Category</span>
            {!loading && totalExpense > 0 && (
              <span className="section-link">{fmtFull(totalExpense)} total</span>
            )}
          </div>
          {loading ? <ChartSkeleton height={240} /> : categoryData.length === 0 ? (
            <EmptyChart height={240} message="No expense categories found" />
          ) : (
            <div className="an-pie-layout">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                    label={<PieLabel />}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend list */}
              <div className="an-pie-legend">
                {categoryData.map(({ name, value, color }) => {
                  const pct = totalExpense > 0 ? Math.round((value / totalExpense) * 100) : 0;
                  return (
                    <div key={name} className="an-pie-legend-item">
                      <div className="an-pie-legend-dot" style={{ background: color }} />
                      <div className="an-pie-legend-info">
                        <span className="an-pie-legend-name">{name}</span>
                        <span className="an-pie-legend-val">{fmtFull(value)}</span>
                      </div>
                      <span className="an-pie-legend-pct" style={{ color }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: Income vs Expense Line Chart ── */}
      <div className="card an-chart-card" style={{ marginTop: 20 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>
          <span className="section-title">Income vs Expense Trend</span>
        </div>
        {loading ? <ChartSkeleton height={260} /> : monthlyData.length === 0 ? (
          <EmptyChart height={260} message="No trend data for this period" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a1a9b4", fontFamily: "var(--font-body)" }}
                axisLine={false} tickLine={false} />
              <YAxis tickFormatter={yFmt} tick={{ fontSize: 11, fill: "#a1a9b4", fontFamily: "var(--font-body)" }}
                axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<LineTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)", paddingTop: 12 }} />
              <Line type="monotone" dataKey="income"  name="Income"  stroke="#3d8c6e"
                strokeWidth={2.5} dot={{ r: 4, fill: "#3d8c6e", strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#d4895a"
                strokeWidth={2.5} dot={{ r: 4, fill: "#d4895a", strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="savings" name="Savings" stroke="#b5cfc4"
                strokeWidth={2} strokeDasharray="5 4"
                dot={{ r: 3, fill: "#b5cfc4", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── INSIGHTS ── */}
      {!loading && insights.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 24 }}>
            <span className="section-title">Smart Insights</span>
          </div>
          <div className="insights-grid">
            {insights.map(({ icon, title, desc, positive }) => (
              <div
                key={title}
                className="insight-card"
                style={{
                  borderLeftColor: positive === true
                    ? "var(--accent-primary)"
                    : positive === false
                      ? "var(--accent-warm)"
                      : "var(--accent-soft)",
                }}
              >
                <div className="insight-icon">{icon}</div>
                <div>
                  <div className="insight-title">{title}</div>
                  <div className="insight-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && transactions.length === 0 && !apiError && (
        <div className="an-no-data">
          <p>No transactions found. Add some transactions to see analytics.</p>
        </div>
      )}
    </div>
  );
}
