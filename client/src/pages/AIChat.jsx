import React, { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage }  from "../api/chatService";
import { fetchTransactions } from "../api/transactionService";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const SUGGESTIONS = [
  "How can I reduce my monthly expenses?",
  "What's my savings rate this month?",
  "Am I on track for my financial goals?",
  "Which category am I overspending on?",
];

const INITIAL_MESSAGE = {
  id:   "init",
  role: "assistant",
  text: "Hi! I'm Finio AI, your personal finance advisor. I have access to your real transactions and budget data. Ask me anything — spending tips, savings goals, or a breakdown of where your money is going.",
  time: "just now",
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

/** Current month as "YYYY-MM" */
function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Compute snapshot figures from raw transactions array */
function computeSnapshot(transactions) {
  const month      = thisMonth();
  const monthTxns  = transactions.filter(t => {
    const d = new Date(t.date);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return k === month;
  });

  const income  = monthTxns.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
  const expense = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const savings = income - expense;
  const balance = transactions.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0)
                - transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return { income, expense, savings, balance };
}

/* ─────────────────────────────────────────────
   MESSAGE COMPONENT  (unchanged from original)
───────────────────────────────────────────── */
function Message({ role, text, time, error }) {
  return (
    <div className={`chat-msg ${role}`}>
      {role === "assistant" && (
        <div className="chat-avatar-bot">✦</div>
      )}
      <div className={`chat-bubble${error ? " chat-bubble--error" : ""}`}>
        {/* Render line breaks from AI response */}
        {text.split("\n").map((line, i) => (
          <p key={i} className="chat-text" style={{ marginBottom: i < text.split("\n").length - 1 ? 6 : 0 }}>
            {line || <>&nbsp;</>}
          </p>
        ))}
        <span className="chat-time">{time}</span>
      </div>
      {role === "user" && (
        <div className="chat-avatar-user">A</div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════ */
export default function AIChat() {
  /* ── Chat state ── */
  const [messages,  setMessages]  = useState([INITIAL_MESSAGE]);
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);  // waiting for API

  /* ── Snapshot panel state ── */
  const [snapshot,      setSnapshot]      = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  const bottomRef = useRef(null);

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  /* ── Load snapshot from live transactions ── */
  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const res = await fetchTransactions();
      setSnapshot(computeSnapshot(res.data.data ?? []));
    } catch {
      // fail silently — snapshot panel shows dashes
      setSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  /* ── Build history array for the API (excludes the initial greeting) ── */
  function buildHistory(currentMessages) {
    return currentMessages
      .filter(m => m.id !== "init" && !m.error)     // skip greeting + error msgs
      .map(m => ({ role: m.role, content: m.text }));
  }

  /* ── Send message ── */
  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const userMsg = {
      id:   Date.now(),
      role: "user",
      text: trimmed,
      time: nowTime(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const history = buildHistory([...messages, userMsg]);

      const res = await sendChatMessage({
        message: trimmed,
        history: history.slice(0, -1), // history excludes the message we just sent
      });

      const aiText = res.data?.reply || "Sorry, I didn't get a response. Please try again.";

      setMessages(prev => [
        ...prev,
        {
          id:   Date.now() + 1,
          role: "assistant",
          text: aiText,
          time: nowTime(),
        },
      ]);
    } catch (err) {
      const errText = err.userMessage || "Something went wrong. Please check your connection and try again.";
      setMessages(prev => [
        ...prev,
        {
          id:    Date.now() + 1,
          role:  "assistant",
          text:  errText,
          time:  nowTime(),
          error: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  /* ── Snapshot display rows ── */
  const snapshotRows = snapshot
    ? [
        { label: "Net Balance", value: fmtINR(snapshot.balance),  color: snapshot.balance  >= 0 ? "var(--accent-primary)" : "var(--accent-warm)" },
        { label: "Income",      value: fmtINR(snapshot.income),   color: "var(--accent-primary)" },
        { label: "Expenses",    value: fmtINR(snapshot.expense),  color: "var(--accent-warm)" },
        { label: "Savings",     value: fmtINR(snapshot.savings),  color: snapshot.savings  >= 0 ? "var(--accent-primary)" : "var(--accent-warm)" },
      ]
    : [
        { label: "Net Balance", value: "—", color: "var(--text-muted)" },
        { label: "Income",      value: "—", color: "var(--text-muted)" },
        { label: "Expenses",    value: "—", color: "var(--text-muted)" },
        { label: "Savings",     value: "—", color: "var(--text-muted)" },
      ];

  /* ═══════════════════════════════════════════
     RENDER  — JSX structure identical to original
  ═══════════════════════════════════════════ */
  return (
    <div className="chat-layout">

      {/* ── Context panel ── */}
      <div className="chat-context-panel">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="chat-context-title">Financial Snapshot</div>

          {snapshotLoading ? (
            /* Skeleton rows while loading */
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="chat-snapshot-row">
                <div className="chat-skeleton" style={{ width: 60,  height: 12 }} />
                <div className="chat-skeleton" style={{ width: 80, height: 12 }} />
              </div>
            ))
          ) : (
            snapshotRows.map(({ label, value, color }) => (
              <div key={label} className="chat-snapshot-row">
                <span className="chat-snapshot-label">{label}</span>
                <span className="chat-snapshot-value" style={{ color }}>{value}</span>
              </div>
            ))
          )}

          <div className="chat-snapshot-meta">
            This month · {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
        </div>

        <div className="card">
          <div className="chat-context-title">Quick Questions</div>
          <div className="chat-suggestions-list">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="chat-suggestion-btn"
                onClick={() => send(s)}
                disabled={thinking}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div className="card chat-panel">

        {/* Header */}
        <div className="chat-panel-header">
          <div className="chat-panel-avatar">✦</div>
          <div>
            <div className="chat-panel-name">Finio AI</div>
            <div className="chat-panel-status">
              <span className={`chat-online-dot${thinking ? " chat-online-dot--thinking" : ""}`} />
              {thinking ? "Thinking…" : "Online · analysing your data"}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map(m => (
            <Message key={m.id} {...m} />
          ))}

          {/* Typing / thinking indicator */}
          {thinking && (
            <div className="chat-msg assistant">
              <div className="chat-avatar-bot">✦</div>
              <div className="chat-bubble typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Ask about your finances…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={thinking}
          />
          <button
            className="chat-send-btn"
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            aria-label="Send"
          >
            {thinking ? (
              <span className="chat-send-spinner" />
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <path d="M17 10L3 3l3 7-3 7 14-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
