import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { fetchTransactions } from "../api/transactionService";

/* ── SVG Icon Components ──────────────────── */
const LogoIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10a7 7 0 1 0 14 0A7 7 0 0 0 3 10z" />
    <path d="M10 7v3l2 2" />
    <path d="M7 3.5A8 8 0 0 1 17 10" strokeDasharray="2 2" />
  </svg>
);

const DashboardIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <rect x="3" y="3" width="6" height="6" rx="2" />
    <rect x="11" y="3" width="6" height="6" rx="2" />
    <rect x="3" y="11" width="6" height="6" rx="2" />
    <rect x="11" y="11" width="6" height="6" rx="2" />
  </svg>
);

const TransactionsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <path d="M3 6h14M3 10h10M3 14h6" />
    <path d="M15 12l3 3-3 3" />
  </svg>
);

const BudgetIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v1.5M10 12.5V14M7.5 8.5C7.5 7.7 8.1 7 9 7h2a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 0 0 3h2c.9 0 1.5-.7 1.5-1.5" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <path d="M3 14l4-5 3 3 3-4 4 3" />
    <line x1="3" y1="17" x2="17" y2="17" />
  </svg>
);

const AIIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <circle cx="10" cy="10" r="3" />
    <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41" />
  </svg>
);

const NotesIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <path d="M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M7 8h6M7 11h4" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <circle cx="10" cy="10" r="3" />
    <path d="M10 2a1 1 0 0 1 1 1v1a6 6 0 0 1 2.66 1.1l.7-.7a1 1 0 1 1 1.41 1.41l-.7.7A6 6 0 0 1 16 9h1a1 1 0 1 1 0 2h-1a6 6 0 0 1-1.1 2.66l.7.7a1 1 0 1 1-1.41 1.41l-.7-.7A6 6 0 0 1 11 17v1a1 1 0 1 1-2 0v-1a6 6 0 0 1-2.66-1.1l-.7.7a1 1 0 1 1-1.41-1.41l.7-.7A6 6 0 0 1 4 11H3a1 1 0 1 1 0-2h1a6 6 0 0 1 1.1-2.66l-.7-.7A1 1 0 1 1 5.81 4.23l.7.7A6 6 0 0 1 9 3V2a1 1 0 0 1 1-1z" />
  </svg>
);

/* ── Nav items config ──────────────────────── */
const NAV_ITEMS = [
  { to: "/",             end: true,  label: "Dashboard",    Icon: DashboardIcon,    section: "Menu"     },
  { to: "/transactions",             label: "Transactions", Icon: TransactionsIcon, section: null       },
  { to: "/budget",                   label: "Budget",       Icon: BudgetIcon,       section: null       },
  { to: "/analytics",                label: "Analytics",    Icon: AnalyticsIcon,    section: null       },
  { to: "/ai",                       label: "AI Assistant", Icon: AIIcon,           section: null       },
  { to: "/notes",                    label: "Notes",        Icon: NotesIcon,        section: null       },
  { to: "/settings",                 label: "Settings",     Icon: SettingsIcon,     section: "Settings" },
];

/* ── Sidebar Component ─────────────────────── */
export default function Sidebar() {
  const [txnCount, setTxnCount] = useState(null);

  useEffect(() => {
    fetchTransactions()
      .then(res => setTxnCount(res.data?.summary?.count ?? res.data?.data?.length ?? 0))
      .catch(() => setTxnCount(null)); // silently fail — badge just won't show
  }, []);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <div className="logo-icon">
            <LogoIcon />
          </div>
          <div className="logo-text">
            <span className="logo-name">Finio</span>
            <span className="logo-tagline">Finance Manager</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, end, label, Icon, section }) => (
          <React.Fragment key={to}>
            {section && (
              <span className="nav-section-label" style={{ marginTop: section === "Settings" ? 12 : 0 }}>
                {section}
              </span>
            )}
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <Icon />
              <span>{label}</span>
              {label === "Transactions" && txnCount !== null && (
                <span className="nav-badge">{txnCount > 99 ? "99+" : txnCount}</span>
              )}
            </NavLink>
          </React.Fragment>
        ))}
      </nav>

      {/* Profile Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-profile">
          <div className="profile-avatar">A</div>
          <div className="profile-info">
            <div className="profile-name">Alex Morgan</div>
            <div className="profile-role">Personal</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
