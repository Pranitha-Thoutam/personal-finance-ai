import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

/* ── Icon helpers ─────────────────────────── */
const MoonIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 12A7.5 7.5 0 0 1 8 2.5a7.5 7.5 0 1 0 9.5 9.5z" />
  </svg>
);

/* ── Page meta map ───────────────────────── */
const PAGE_META = {
  "/":             { title: "Dashboard",    subtitle: "Welcome back! Here's your financial overview." },
  "/transactions": { title: "Transactions", subtitle: "All your money movements" },
  "/budget":       { title: "Budget",       subtitle: "Track & manage spending limits" },
  "/analytics":    { title: "Analytics",    subtitle: "Insights & trends" },
  "/ai":           { title: "AI Assistant", subtitle: "Your personal finance advisor" },
  "/notes":        { title: "Notes",        subtitle: "Your finance goals and reminders" },
};

/* ── Layout Component ─────────────────────── */
export default function Layout() {
  const { pathname } = useLocation();
  const { title, subtitle } = PAGE_META[pathname] ?? PAGE_META["/"];

  return (
    <div className="layout">
      {/* Left: Sidebar */}
      <Sidebar />

      {/* Right: Main */}
      <div className="main-content">
        {/* Top bar */}
        <header className="main-topbar">
          <div className="topbar-left">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-right">
            {/* Dark mode toggle — UI only */}
            <button className="topbar-btn" aria-label="Toggle dark mode">
              <MoonIcon />
            </button>

            {/* Profile avatar */}
            <div className="topbar-avatar" aria-label="Profile">
              A
            </div>
          </div>
        </header>

        {/* Routed page content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

