import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchNotes, createNote, removeNote } from "../api/notesService";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const TAG_OPTIONS = ["", "goal", "reminder", "idea", "review", "savings"];

const TAG_STYLES = {
  goal:     { bg: "#e8f4ef", color: "#3d8c6e" },
  reminder: { bg: "#fdf0e8", color: "#d4895a" },
  idea:     { bg: "#e8f0fd", color: "#4a7fd4" },
  review:   { bg: "#fce8f0", color: "#b45a9e" },
  savings:  { bg: "#f0fce8", color: "#1d9e75" },
};

const TAG_EMOJIS = {
  goal: "🎯", reminder: "🔔", idea: "💡", review: "📋", savings: "💰",
};

const MAX_CHARS = 500;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function fmtDate(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  const diffMs   = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)  return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs  < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays}d ago`;

  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/* ─────────────────────────────────────────────
   SMALL HELPERS
───────────────────────────────────────────── */
function Skeleton({ w = "100%", h = 14, style = {} }) {
  return <div className="nt-skeleton" style={{ width: w, height: h, borderRadius: 6, ...style }} />;
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="nt-error-banner">
      <span>⚠ {message}</span>
      <button className="nt-error-close" onClick={onDismiss}>✕</button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   NOTE CARD COMPONENT
───────────────────────────────────────────── */
function NoteCard({ note, onDelete, deleting }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tagStyle = note.tag ? TAG_STYLES[note.tag] : null;

  return (
    <div className={`nt-card${deleting ? " nt-card--deleting" : ""}`}>
      {/* Top row */}
      <div className="nt-card-top">
        <div className="nt-card-meta">
          {note.tag && tagStyle && (
            <span className="nt-tag" style={{ background: tagStyle.bg, color: tagStyle.color }}>
              {TAG_EMOJIS[note.tag]} {note.tag}
            </span>
          )}
          <span className="nt-date">{fmtDate(note.createdAt)}</span>
        </div>

        {/* Action buttons */}
        <div className="nt-card-actions">
          {deleting ? (
            <span className="nt-spinner" />
          ) : confirmDelete ? (
            <div className="nt-confirm">
              <span className="nt-confirm-txt">Delete?</span>
              <button className="nt-confirm-yes" onClick={() => onDelete(note._id)}>Yes</button>
              <button className="nt-confirm-no"  onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          ) : (
            <button
              className="nt-delete-btn"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete note"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h12M8 6V4h4v2M7 6l1 10h4l1-10" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Note text */}
      <p className="nt-text">{note.text}</p>
    </div>
  );
}

/* ═════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════ */
export default function Notes() {
  /* ── State ── */
  const [notes,      setNotes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [apiError,   setApiError]   = useState("");
  const [activeTag,  setActiveTag]  = useState("");  // filter

  /* ── Form state ── */
  const [text,     setText]     = useState("");
  const [tag,      setTag]      = useState("");
  const [formErr,  setFormErr]  = useState("");

  const textareaRef = useRef(null);

  /* ── Load notes ── */
  const load = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetchNotes();
      setNotes(res.data.data ?? []);
    } catch (err) {
      setApiError(err.userMessage || "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Filtered list ── */
  const visible = activeTag
    ? notes.filter(n => n.tag === activeTag)
    : notes;

  /* ── Add note ── */
  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) { setFormErr("Note cannot be empty."); return; }
    if (text.trim().length > MAX_CHARS) { setFormErr(`Max ${MAX_CHARS} characters.`); return; }
    setFormErr("");
    setSaving(true);
    setApiError("");
    try {
      const res = await createNote({ text: text.trim(), tag });
      setNotes(prev => [res.data.data, ...prev]);
      setText("");
      setTag("");
      textareaRef.current?.focus();
    } catch (err) {
      setApiError(err.userMessage || "Failed to add note.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete note ── */
  async function handleDelete(id) {
    setDeletingId(id);
    setApiError("");
    try {
      await removeNote(id);
      setNotes(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      setApiError(err.userMessage || "Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  }

  /* ── Keyboard shortcut: Ctrl/Cmd + Enter to submit ── */
  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleAdd(e);
    }
  }

  /* ── Tag counts for filter badges ── */
  const tagCounts = notes.reduce((acc, n) => {
    if (n.tag) acc[n.tag] = (acc[n.tag] || 0) + 1;
    return acc;
  }, {});

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="nt-root">
      <ErrorBanner message={apiError} onDismiss={() => setApiError("")} />

      <div className="nt-body">

        {/* ════ ADD NOTE FORM ════ */}
        <div className="card nt-form-card">
          <h2 className="nt-section-title">New Note</h2>

          <form className="nt-form" onSubmit={handleAdd} noValidate>

            {/* Textarea */}
            <div className="nt-field">
              <textarea
                ref={textareaRef}
                className={`nt-textarea${formErr ? " nt-textarea--err" : ""}`}
                rows={5}
                placeholder="Write a finance note, goal, or reminder…"
                value={text}
                onChange={e => { setText(e.target.value); setFormErr(""); }}
                onKeyDown={handleKeyDown}
                maxLength={MAX_CHARS}
                disabled={saving}
              />
              <div className="nt-char-row">
                {formErr
                  ? <span className="nt-field-error">{formErr}</span>
                  : <span className="nt-char-hint">Ctrl + Enter to save</span>
                }
                <span className={`nt-char-count${text.length > MAX_CHARS * 0.9 ? " nt-char-count--warn" : ""}`}>
                  {text.length}/{MAX_CHARS}
                </span>
              </div>
            </div>

            {/* Tag selector */}
            <div className="nt-field">
              <label className="nt-label">Tag <span className="nt-optional">(optional)</span></label>
              <div className="nt-tag-options">
                {TAG_OPTIONS.map(t => (
                  <button
                    key={t || "none"}
                    type="button"
                    className={`nt-tag-btn${tag === t ? " active" : ""}`}
                    style={tag === t && t && TAG_STYLES[t]
                      ? { background: TAG_STYLES[t].bg, color: TAG_STYLES[t].color, borderColor: TAG_STYLES[t].color + "60" }
                      : {}}
                    onClick={() => setTag(t)}
                    disabled={saving}
                  >
                    {t ? `${TAG_EMOJIS[t]} ${t}` : "None"}
                  </button>
                ))}
              </div>
            </div>

            <button className="nt-submit" type="submit" disabled={saving || !text.trim()}>
              {saving
                ? <><span className="nt-btn-spinner" />Saving…</>
                : <>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" />
                    </svg>
                    Add Note
                  </>
              }
            </button>
          </form>

          {/* Stats row */}
          {!loading && notes.length > 0 && (
            <div className="nt-stats">
              <div className="nt-stat">
                <span className="nt-stat-value">{notes.length}</span>
                <span className="nt-stat-label">Total</span>
              </div>
              {Object.entries(tagCounts).map(([t, count]) => (
                <div key={t} className="nt-stat">
                  <span className="nt-stat-value">{count}</span>
                  <span className="nt-stat-label">{TAG_EMOJIS[t]} {t}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════ NOTES LIST ════ */}
        <div className="nt-list-panel">

          {/* Filter bar */}
          <div className="nt-filter-row">
            <div className="nt-filter-group">
              <button
                className={`nt-filter-btn${activeTag === "" ? " active" : ""}`}
                onClick={() => setActiveTag("")}
              >
                All <span className="nt-filter-count">{notes.length}</span>
              </button>
              {Object.entries(tagCounts).map(([t, count]) => (
                <button
                  key={t}
                  className={`nt-filter-btn${activeTag === t ? " active" : ""}`}
                  style={activeTag === t && TAG_STYLES[t]
                    ? { background: TAG_STYLES[t].bg, color: TAG_STYLES[t].color, borderColor: TAG_STYLES[t].color + "50" }
                    : {}}
                  onClick={() => setActiveTag(t)}
                >
                  {TAG_EMOJIS[t]} {t} <span className="nt-filter-count">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Loading skeletons */}
          {loading ? (
            <div className="nt-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="nt-card">
                  <div className="nt-card-top">
                    <Skeleton w={70} h={22} style={{ borderRadius: 20 }} />
                    <Skeleton w={28} h={28} style={{ borderRadius: 8 }} />
                  </div>
                  <Skeleton w="100%" h={13} style={{ marginTop: 12 }} />
                  <Skeleton w="80%"  h={13} style={{ marginTop: 6 }} />
                  <Skeleton w="60%"  h={13} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>

          /* Empty state */
          ) : visible.length === 0 ? (
            <div className="nt-empty">
              <div className="nt-empty-icon">📝</div>
              <p className="nt-empty-title">
                {activeTag ? `No ${activeTag} notes yet` : "No notes yet"}
              </p>
              <p className="nt-empty-sub">
                {activeTag
                  ? `Add a note with the "${activeTag}" tag to see it here.`
                  : "Write your first finance note, goal, or reminder using the form."}
              </p>
            </div>

          /* Notes grid */
          ) : (
            <div className="nt-grid">
              {visible.map(note => (
                <NoteCard
                  key={note._id}
                  note={note}
                  onDelete={handleDelete}
                  deleting={deletingId === note._id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
