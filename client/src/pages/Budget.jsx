import React, { useState, useEffect, useCallback } from "react";
import { fetchBudget, saveBudget } from "../api/budgetService";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CATEGORY_META = {
  Housing:       { emoji: "🏠", color: "#3d8c6e" },
  Food:          { emoji: "🍽️",  color: "#d4895a" },
  Transport:     { emoji: "🚗", color: "#4a7fd4" },
  Bills:         { emoji: "⚡", color: "#6b5dd4" },
  Health:        { emoji: "💊", color: "#3d8c6e" },
  Shopping:      { emoji: "🛍️",  color: "#b45a9e" },
  Entertainment: { emoji: "🎬", color: "#e0875a" },
  Education:     { emoji: "📚", color: "#4a7fd4" },
  Investment:    { emoji: "📈", color: "#1d9e75" },
  Other:         { emoji: "📌", color: "#a1a9b4" },
};

function getCategoryMeta(name) {
  return CATEGORY_META[name] || { emoji: "📂", color: "#a1a9b4" };
}

/* "YYYY-MM" for current month */
function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* "April 2025" display label */
function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function fmt(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

/* ─────────────────────────────────────────────
   SMALL HELPERS
───────────────────────────────────────────── */
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bp-error-banner">
      <span>⚠ {message}</span>
      <button className="bp-error-close" onClick={onDismiss}>✕</button>
    </div>
  );
}

function Skeleton({ w = "100%", h = 14 }) {
  return <div className="bp-skeleton" style={{ width: w, height: h }} />;
}

/* ─────────────────────────────────────────────
   PROGRESS BAR COMPONENT
───────────────────────────────────────────── */
function ProgressBar({ pct, color, height = 8, warn = false, over = false }) {
  const clampedPct = Math.min(pct, 100);
  const barColor = over ? "var(--accent-warm)" : warn ? "#e0a060" : color || "var(--accent-primary)";
  return (
    <div className="bp-bar-track" style={{ height }}>
      <div
        className="bp-bar-fill"
        style={{ width: `${clampedPct}%`, background: barColor, height }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   CATEGORY ROW
───────────────────────────────────────────── */
function CategoryRow({ name, spent, limit }) {
  const meta      = getCategoryMeta(name);
  const hasLimit  = limit > 0;
  const pct       = hasLimit ? Math.round((spent / limit) * 100) : 0;
  const remaining = hasLimit ? limit - spent : null;
  const over      = hasLimit && spent > limit;
  const warn      = hasLimit && pct >= 80 && !over;

  return (
    <div className="bp-cat-row">
      <div className="bp-cat-top">
        <div className="bp-cat-left">
          <div className="bp-cat-icon" style={{ background: meta.color + "18" }}>
            {meta.emoji}
          </div>
          <div>
            <div className="bp-cat-name">{name}</div>
            <div className="bp-cat-sub">
              {!hasLimit ? (
                <span className="bp-cat-no-limit">No limit set</span>
              ) : over ? (
                <span className="bp-cat-over">Over by {fmt(spent - limit)}</span>
              ) : (
                <span>{fmt(remaining)} left</span>
              )}
            </div>
          </div>
        </div>
        <div className="bp-cat-right">
          {hasLimit && (
            <span
              className="bp-cat-pct"
              style={{ color: over ? "var(--accent-warm)" : warn ? "#e0a060" : meta.color }}
            >
              {pct}%
            </span>
          )}
          <span className="bp-cat-amounts">
            {fmt(spent)}{hasLimit ? ` / ${fmt(limit)}` : ""}
          </span>
        </div>
      </div>
      {hasLimit && (
        <ProgressBar pct={pct} color={meta.color} warn={warn} over={over} />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════ */
export default function Budget() {
  const [month]  = useState(thisMonth);

  /* ── API data ── */
  const [budget,       setBudgetData]    = useState(null);   // budget doc from DB
  const [analytics,    setAnalytics]     = useState(null);   // spend totals + categorySpend
  const [budgetSet,    setBudgetSet]     = useState(false);

  /* ── UI state ── */
  const [loading,      setLoading]       = useState(true);
  const [saving,       setSaving]        = useState(false);
  const [apiError,     setApiError]      = useState("");
  const [saveSuccess,  setSaveSuccess]   = useState(false);

  /* ── Form state ── */
  const [budgetInput,  setBudgetInput]   = useState("");
  const [formError,    setFormError]     = useState("");

  /* ── Fetch budget + analytics ── */
  const loadBudget = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetchBudget(month);
      setBudgetSet(res.data.budgetSet);
      setBudgetData(res.data.data);
      setAnalytics(res.data.analytics);
      if (res.data.data?.monthlyBudget) {
        setBudgetInput(String(res.data.data.monthlyBudget));
      }
    } catch (err) {
      setApiError(err.userMessage || "Failed to load budget data.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { loadBudget(); }, [loadBudget]);

  /* ── Save budget ── */
  async function handleSave(e) {
    e.preventDefault();
    const val = parseFloat(budgetInput);
    if (!budgetInput || isNaN(val) || val < 0) {
      setFormError("Enter a valid budget amount (0 or more).");
      return;
    }
    setFormError("");
    setSaving(true);
    setApiError("");
    setSaveSuccess(false);
    try {
      const res = await saveBudget({ monthlyBudget: val, month });
      setBudgetSet(true);
      setBudgetData(res.data.data);
      setAnalytics(res.data.analytics);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setApiError(err.userMessage || "Failed to save budget.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Derived display values ── */
  const monthlyBudget  = budget?.monthlyBudget        ?? 0;
  const totalExpense   = analytics?.totalExpense       ?? 0;
  const totalIncome    = analytics?.totalIncome        ?? 0;
  const remaining      = analytics?.remaining          ?? (monthlyBudget - totalExpense);
  const usedPct        = monthlyBudget > 0
    ? Math.min(Math.round((totalExpense / monthlyBudget) * 100), 100)
    : 0;
  const overBudget     = budgetSet && totalExpense > monthlyBudget;
  const warnBudget     = budgetSet && usedPct >= 80 && !overBudget;

  const categorySpend  = analytics?.categorySpend ?? {};
  const categoryLimits = budget?.categoryLimits   ?? {};
  const categoryNames  = Object.keys(categorySpend).sort(
    (a, b) => categorySpend[b] - categorySpend[a]
  );

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="bp-root">
      <ErrorBanner message={apiError} onDismiss={() => setApiError("")} />

      {/* ── Two-column layout: form + overview ── */}
      <div className="bp-top-row">

        {/* ── SET BUDGET FORM ── */}
        <div className="card bp-set-card">
          <h2 className="bp-section-title">Monthly Budget</h2>
          <p className="bp-month-label">{monthLabel(month)}</p>

          <form className="bp-form" onSubmit={handleSave} noValidate>
            <div className="bp-field">
              <label className="bp-label">Set Total Budget</label>
              <div className="bp-input-wrap">
                <span className="bp-prefix">₹</span>
                <input
                  className={`bp-input${formError ? " bp-input--err" : ""}`}
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 50000"
                  value={budgetInput}
                  onChange={e => { setBudgetInput(e.target.value); setFormError(""); }}
                  disabled={saving}
                />
              </div>
              {formError && <span className="bp-field-error">{formError}</span>}
            </div>

            <button className="bp-save-btn" type="submit" disabled={saving}>
              {saving
                ? <><span className="bp-spinner" />Saving…</>
                : budgetSet ? "Update Budget" : "Set Budget"
              }
            </button>

            {saveSuccess && (
              <div className="bp-success-msg">
                ✓ Budget saved for {monthLabel(month)}
              </div>
            )}
          </form>

          {/* Quick tips */}
          <div className="bp-tip-box">
            <div className="bp-tip-title">💡 Budgeting tips</div>
            <ul className="bp-tip-list">
              <li>Aim to keep expenses under 70% of income</li>
              <li>Save at least 20% each month</li>
              <li>Review your top categories regularly</li>
            </ul>
          </div>
        </div>

        {/* ── OVERVIEW CARDS ── */}
        <div className="bp-overview-panel">
          <div className="bp-kpi-grid">
            {/* Monthly Budget */}
            <div className="card bp-kpi-card">
              <div className="bp-kpi-label">Monthly Budget</div>
              {loading
                ? <Skeleton w={100} h={28} />
                : <div className="bp-kpi-value">{budgetSet ? fmt(monthlyBudget) : "Not set"}</div>
              }
              <div className="bp-kpi-sub">{monthLabel(month)}</div>
            </div>

            {/* Total Spent */}
            <div className="card bp-kpi-card">
              <div className="bp-kpi-label">Total Spent</div>
              {loading
                ? <Skeleton w={100} h={28} />
                : <div className="bp-kpi-value bp-kpi-value--warm">{fmt(totalExpense)}</div>
              }
              <div className="bp-kpi-sub">
                {budgetSet ? `${usedPct}% of budget` : "this month"}
              </div>
            </div>

            {/* Remaining */}
            <div className="card bp-kpi-card">
              <div className="bp-kpi-label">Remaining</div>
              {loading
                ? <Skeleton w={100} h={28} />
                : <div className={`bp-kpi-value ${overBudget ? "bp-kpi-value--warm" : "bp-kpi-value--green"}`}>
                    {budgetSet ? fmt(Math.abs(remaining)) : "—"}
                  </div>
              }
              <div className="bp-kpi-sub">
                {budgetSet
                  ? overBudget ? "over budget" : "left to spend"
                  : "set a budget to track"
                }
              </div>
            </div>

            {/* Total Income */}
            <div className="card bp-kpi-card">
              <div className="bp-kpi-label">Total Income</div>
              {loading
                ? <Skeleton w={100} h={28} />
                : <div className="bp-kpi-value bp-kpi-value--green">{fmt(totalIncome)}</div>
              }
              <div className="bp-kpi-sub">this month</div>
            </div>
          </div>

          {/* ── Main progress bar ── */}
          <div className="card bp-progress-card">
            <div className="bp-progress-header">
              <span className="bp-section-title" style={{ fontSize: 16 }}>
                Budget Usage
              </span>
              {loading
                ? <Skeleton w={50} h={14} />
                : budgetSet
                  ? <span
                      className="bp-pct-label"
                      style={{ color: overBudget ? "var(--accent-warm)" : warnBudget ? "#e0a060" : "var(--accent-primary)" }}
                    >
                      {usedPct}% used
                    </span>
                  : <span className="bp-pct-label" style={{ color: "var(--text-muted)" }}>No budget set</span>
              }
            </div>

            {loading ? (
              <Skeleton w="100%" h={14} />
            ) : (
              <>
                <ProgressBar
                  pct={budgetSet ? usedPct : 0}
                  height={14}
                  warn={warnBudget}
                  over={overBudget}
                />
                <div className="bp-bar-legend">
                  <div className="bp-bar-legend-item">
                    <div className="bp-legend-dot" style={{ background: "var(--accent-warm)" }} />
                    <span>Spent {fmt(totalExpense)}</span>
                  </div>
                  {budgetSet && (
                    <div className="bp-bar-legend-item">
                      <div className="bp-legend-dot" style={{ background: "var(--bg-card-alt)", border: "1.5px solid var(--border-card)" }} />
                      <span>Budget {fmt(monthlyBudget)}</span>
                    </div>
                  )}
                </div>

                {/* Status chip */}
                {budgetSet && (
                  <div className={`bp-status-chip ${overBudget ? "over" : warnBudget ? "warn" : "ok"}`}>
                    {overBudget
                      ? `⚠ Over budget by ${fmt(totalExpense - monthlyBudget)}`
                      : warnBudget
                        ? `⚠ ${100 - usedPct}% of budget remains — almost there`
                        : `✓ On track — ${fmt(remaining)} remaining`
                    }
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CATEGORY BREAKDOWN ── */}
      <div className="card bp-cat-card">
        <div className="bp-section-header">
          <h2 className="bp-section-title" style={{ marginBottom: 0 }}>
            Spending by Category
          </h2>
          <span className="bp-cat-count">{categoryNames.length} categories</span>
        </div>

        {loading ? (
          <div className="bp-cat-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bp-cat-row" style={{ gap: 12 }}>
                <Skeleton w={36} h={36} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skeleton w={100} h={13} />
                  <Skeleton w="100%" h={6} />
                </div>
              </div>
            ))}
          </div>
        ) : categoryNames.length === 0 ? (
          <div className="bp-cat-empty">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
              <circle cx="24" cy="24" r="20" /><path d="M24 16v8M24 30v2" />
            </svg>
            <p>No expense transactions found for {monthLabel(month)}.</p>
          </div>
        ) : (
          <div className="bp-cat-list">
            {categoryNames.map(name => (
              <CategoryRow
                key={name}
                name={name}
                spent={categorySpend[name]}
                limit={categoryLimits instanceof Map
                  ? (categoryLimits.get(name) ?? 0)
                  : (categoryLimits?.[name] ?? 0)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
