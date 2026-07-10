import React, { useState, useEffect, useCallback } from "react";
import {
  fetchTransactions,
  createTransaction,
  removeTransaction,
} from "../api/transactionService";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CATEGORIES = {
  income:  ["Salary", "Freelance", "Investment", "Bonus", "Gift", "Other"],
  expense: ["Food", "Transport", "Bills", "Health", "Shopping", "Entertainment", "Housing", "Education", "Other"],
};

const TYPE_STYLE = {
  income:  { bg: "#e8f4ef", color: "#3d8c6e", label: "Income"  },
  expense: { bg: "#fdf0e8", color: "#d4895a", label: "Expense" },
};

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY = { type: "expense", category: "Food", amount: "", date: today(), note: "" };

/* ─────────────────────────────────────────────
   ICONS
───────────────────────────────────────────── */
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M8 6V4h4v2M7 6l1 10h4l1-10" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8l5 5 5-5" />
  </svg>
);

/* ─────────────────────────────────────────────
   SMALL UI HELPERS
───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="txnp-skeleton-row">
      {[60, 80, 120, 70, 80, 30].map((w, i) => (
        <td key={i} style={{ padding: "13px 14px" }}>
          <div className="txnp-skeleton" style={{ width: w, height: 13 }} />
        </td>
      ))}
    </tr>
  );
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="txnp-error-banner">
      <span>⚠ {message}</span>
      <button className="txnp-error-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

/* ═════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════ */
export default function Transactions() {

  /* ── State ── */
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]           = useState({ totalIncome: 0, totalExpense: 0, netBalance: 0, count: 0 });
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [deletingId, setDeletingId]     = useState(null);
  const [deleteId, setDeleteId]         = useState(null);
  const [apiError, setApiError]         = useState("");
  const [form, setForm]                 = useState(EMPTY);
  const [errors, setErrors]             = useState({});
  const [filter, setFilter]             = useState("all");
  const [sortBy, setSortBy]             = useState("date");

  /* ── Load on mount ── */
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetchTransactions();
      setTransactions(res.data.data    ?? []);
      setSummary(res.data.summary      ?? { totalIncome: 0, totalExpense: 0, netBalance: 0, count: 0 });
    } catch (err) {
      setApiError(err.userMessage || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  /* ── Client filter + sort ── */
  const visible = transactions
    .filter(t => filter === "all" || t.type === filter)
    .sort((a, b) =>
      sortBy === "date"
        ? new Date(b.date) - new Date(a.date)
        : b.amount - a.amount
    );

  /* ── Form helpers ── */
  function setField(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === "type") next.category = CATEGORIES[value][0];
      return next;
    });
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      e.amount = "Enter a valid amount greater than 0";
    if (!form.category.trim())
      e.category = "Category is required";
    if (!form.date)
      e.date = "Date is required";
    return e;
  }

  /* ── POST: add ── */
  async function handleAdd(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setApiError("");
    try {
      const res = await createTransaction({
        type:     form.type,
        category: form.category.trim(),
        amount:   parseFloat(form.amount),
        date:     form.date,
        note:     form.note.trim(),
      });
      const created = res.data.data;
      setTransactions(prev => [created, ...prev]);
      setSummary(prev => {
        const next = { ...prev, count: prev.count + 1 };
        if (created.type === "income") next.totalIncome  = prev.totalIncome  + created.amount;
        else                           next.totalExpense = prev.totalExpense + created.amount;
        next.netBalance = next.totalIncome - next.totalExpense;
        return next;
      });
      setForm(EMPTY);
      setErrors({});
    } catch (err) {
      setApiError(err.userMessage || "Failed to add transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── DELETE: remove ── */
  async function handleDelete(id) {
    setDeletingId(id);
    setApiError("");
    try {
      await removeTransaction(id);
      const removed = transactions.find(t => (t._id ?? t.id) === id);
      setTransactions(prev => prev.filter(t => (t._id ?? t.id) !== id));
      if (removed) {
        setSummary(prev => {
          const next = { ...prev, count: Math.max(0, prev.count - 1) };
          if (removed.type === "income") next.totalIncome  = Math.max(0, prev.totalIncome  - removed.amount);
          else                           next.totalExpense = Math.max(0, prev.totalExpense - removed.amount);
          next.netBalance = next.totalIncome - next.totalExpense;
          return next;
        });
      }
    } catch (err) {
      setApiError(err.userMessage || "Failed to delete transaction.");
    } finally {
      setDeletingId(null);
      setDeleteId(null);
    }
  }

  /* ── Render date ── */
  function fmtDate(d) {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="txnp-root">

      <ErrorBanner message={apiError} onDismiss={() => setApiError("")} />

      {/* Summary strip */}
      <div className="txnp-strip">
        <div className="txnp-strip-item">
          <span className="txnp-strip-label">Total Income</span>
          <span className="txnp-strip-value income">{fmt(summary.totalIncome)}</span>
        </div>
        <div className="txnp-strip-divider" />
        <div className="txnp-strip-item">
          <span className="txnp-strip-label">Total Expenses</span>
          <span className="txnp-strip-value expense">{fmt(summary.totalExpense)}</span>
        </div>
        <div className="txnp-strip-divider" />
        <div className="txnp-strip-item">
          <span className="txnp-strip-label">Net Balance</span>
          <span className={`txnp-strip-value ${summary.netBalance >= 0 ? "income" : "expense"}`}>
            {summary.netBalance >= 0 ? "+" : ""}{fmt(summary.netBalance)}
          </span>
        </div>
        <div className="txnp-strip-divider" />
        <div className="txnp-strip-item">
          <span className="txnp-strip-label">Transactions</span>
          <span className="txnp-strip-value neutral">{summary.count}</span>
        </div>
      </div>

      {/* Body */}
      <div className="txnp-body">

        {/* ════ ADD FORM ════ */}
        <div className="card txnp-form-card">
          <h2 className="txnp-section-title">Add Transaction</h2>

          <form className="txnp-form" onSubmit={handleAdd} noValidate>

            <div className="txnp-field">
              <label className="txnp-label">Type</label>
              <div className="txnp-select-wrap">
                <select
                  className={`txnp-select txnp-select--${form.type}`}
                  value={form.type}
                  onChange={e => setField("type", e.target.value)}
                  disabled={submitting}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <span className="txnp-chevron"><ChevronIcon /></span>
              </div>
            </div>

            <div className="txnp-field">
              <label className="txnp-label">Amount</label>
              <div className="txnp-input-wrap">
                <span className="txnp-prefix">₹</span>
                <input
                  className={`txnp-input txnp-input--pre${errors.amount ? " txnp-input--err" : ""}`}
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={e => setField("amount", e.target.value)}
                  disabled={submitting}
                />
              </div>
              {errors.amount && <span className="txnp-error-msg">{errors.amount}</span>}
            </div>

            <div className="txnp-field">
              <label className="txnp-label">Category</label>
              <div className="txnp-select-wrap">
                <select
                  className={`txnp-select${errors.category ? " txnp-input--err" : ""}`}
                  value={form.category}
                  onChange={e => setField("category", e.target.value)}
                  disabled={submitting}
                >
                  {CATEGORIES[form.type].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="txnp-chevron"><ChevronIcon /></span>
              </div>
              {errors.category && <span className="txnp-error-msg">{errors.category}</span>}
            </div>

            <div className="txnp-field">
              <label className="txnp-label">Date</label>
              <input
                className={`txnp-input${errors.date ? " txnp-input--err" : ""}`}
                type="date"
                value={form.date}
                onChange={e => setField("date", e.target.value)}
                disabled={submitting}
              />
              {errors.date && <span className="txnp-error-msg">{errors.date}</span>}
            </div>

            <div className="txnp-field">
              <label className="txnp-label">
                Note <span className="txnp-optional">(optional)</span>
              </label>
              <input
                className="txnp-input"
                type="text" placeholder="e.g. Swiggy dinner"
                value={form.note}
                onChange={e => setField("note", e.target.value)}
                maxLength={80}
                disabled={submitting}
              />
            </div>

            <button className="txnp-submit" type="submit" disabled={submitting}>
              {submitting
                ? <><span className="txnp-spinner" />Saving…</>
                : <><PlusIcon />Add Transaction</>
              }
            </button>
          </form>
        </div>

        {/* ════ TABLE ════ */}
        <div className="card txnp-table-card">

          <div className="txnp-toolbar">
            <div className="txnp-toolbar-left">
              <h2 className="txnp-section-title" style={{ marginBottom: 0 }}>All Transactions</h2>
              <span className="txnp-count-badge">{visible.length}</span>
            </div>
            <div className="txnp-toolbar-right">
              <div className="txnp-filter-group">
                {[
                  { key: "all",     label: "All"     },
                  { key: "income",  label: "Income"  },
                  { key: "expense", label: "Expense" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    className={`txnp-filter-btn txnp-filter-btn--${key}${filter === key ? " active" : ""}`}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="txnp-sort-wrap">
                <span className="txnp-sort-label">Sort by</span>
                <div className="txnp-select-wrap" style={{ minWidth: 110 }}>
                  <select
                    className="txnp-select txnp-select--sm"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                  >
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                  </select>
                  <span className="txnp-chevron"><ChevronIcon /></span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading skeleton */}
          {loading ? (
            <div className="txnp-table-scroll">
              <table className="txnp-table">
                <thead>
                  <tr>
                    <th>Type</th><th>Category</th><th>Note</th>
                    <th>Date</th><th className="txnp-th-r">Amount</th><th></th>
                  </tr>
                </thead>
                <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
              </table>
            </div>

          /* Empty state */
          ) : visible.length === 0 ? (
            <div className="txnp-empty">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="24" r="20" /><path d="M24 16v8M24 30v2" />
              </svg>
              <p className="txnp-empty-title">No transactions found</p>
              <p className="txnp-empty-sub">Try a different filter or add a new transaction.</p>
            </div>

          /* Data table */
          ) : (
            <div className="txnp-table-scroll">
              <table className="txnp-table">
                <thead>
                  <tr>
                    <th>Type</th><th>Category</th><th>Note</th>
                    <th>Date</th><th className="txnp-th-r">Amount</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(t => {
                    const id = t._id ?? t.id;
                    const isDeleting = deletingId === id;
                    return (
                      <tr
                        key={id}
                        className={[
                          deleteId  === id ? "txnp-row-confirm"  : "",
                          isDeleting       ? "txnp-row-deleting" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <td>
                          <span className="txnp-badge" style={{ background: TYPE_STYLE[t.type].bg, color: TYPE_STYLE[t.type].color }}>
                            {t.type === "income" ? "↑" : "↓"}&nbsp;{TYPE_STYLE[t.type].label}
                          </span>
                        </td>
                        <td className="txnp-td-cat">{t.category}</td>
                        <td className="txnp-td-note">{t.note || <span className="txnp-dash">—</span>}</td>
                        <td className="txnp-td-date">{fmtDate(t.date)}</td>
                        <td className="txnp-th-r">
                          <span className={t.type === "income" ? "txnp-amt-in" : "txnp-amt-out"}>
                            {t.type === "income" ? "+" : "−"}{fmt(t.amount)}
                          </span>
                        </td>
                        <td className="txnp-td-action">
                          {isDeleting ? (
                            <span className="txnp-spinner txnp-spinner--sm" />
                          ) : deleteId === id ? (
                            <div className="txnp-confirm">
                              <span className="txnp-confirm-txt">Delete?</span>
                              <button className="txnp-confirm-yes" onClick={() => handleDelete(id)}>Yes</button>
                              <button className="txnp-confirm-no"  onClick={() => setDeleteId(null)}>No</button>
                            </div>
                          ) : (
                            <button className="txnp-del-btn" onClick={() => setDeleteId(id)} aria-label="Delete">
                              <TrashIcon />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
