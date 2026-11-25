import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ArrowRight, Lock, Menu, X, LayoutDashboard, UserCheck } from "lucide-react";

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  return (
    <>
      <header className="navbar">
        <Link to="/" className="navbar-brand-wrap" aria-label="Smart Associate Home">
          <div className="brand-emblem brand-emblem-logo">
            <img src="/smart-audit-circle.png" alt="" className="brand-emblem-image" />
          </div>
          <div className="brand-titles">
            <span className="brand-firm-name">Aravind &amp; Associates</span>
            <span className="brand-firm-tag">Smart Associate • CA Staff Portal</span>
          </div>
        </Link>

        <nav className="navbar-links" aria-label="Main Navigation">
          <a href="/#home">Overview</a>
          <a href="/#features">Platform Modules</a>
          <a href="/#practice">Practice Focus</a>
          <a href="/#about">About Firm</a>
          <Link to="/backend-test" style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
            Diagnostics
          </Link>
        </nav>

        <div className="navbar-actions">
          <div className="nav-portal-badge">
            <span className="live-dot"></span>
            <span>Practice Live</span>
          </div>

          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              <LayoutDashboard size={14} />
              <span>Dashboard ({user?.name?.split(" ")[0] || "Staff"})</span>
              <ArrowRight size={14} />
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              <Lock size={14} />
              <span>Staff Login</span>
              <ArrowRight size={14} />
            </Link>
          )}

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}>
        <a href="/#home" onClick={() => setMobileMenuOpen(false)}>
          Overview
        </a>
        <a href="/#features" onClick={() => setMobileMenuOpen(false)}>
          Platform Modules
        </a>
        <a href="/#practice" onClick={() => setMobileMenuOpen(false)}>
          Practice Focus
        </a>
        <a href="/#about" onClick={() => setMobileMenuOpen(false)}>
          About Firm
        </a>
        <Link to="/backend-test" onClick={() => setMobileMenuOpen(false)}>
          System Diagnostics
        </Link>
        {isAuthenticated ? (
          <Link
            to="/dashboard"
            className="btn btn-primary"
            style={{ marginTop: "12px", width: "100%" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <LayoutDashboard size={15} />
            <span>Go to Staff Dashboard</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="btn btn-primary"
            style={{ marginTop: "12px", width: "100%" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Lock size={15} />
            <span>Staff Login</span>
          </Link>
        )}
      </div>
    </>
  );
}

export default Navbar;