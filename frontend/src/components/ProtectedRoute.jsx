import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react";

/**
 * Route guard that requires authentication and optionally verifies role-based permissions
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user, hasRole } = useAuth();
  const location = useLocation();

  // 1. Initial Session Restoration Loading State
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-app)",
          gap: "16px",
          fontFamily: "inherit",
        }}
      >
        <div className="brand-emblem brand-emblem-logo" style={{ width: 44, height: 44 }}>
          <img src="/smart-audit-circle.png" alt="" className="brand-emblem-image" />
        </div>
        <div style={{ textAlign: "center" }}>
          <strong style={{ fontSize: "16px", color: "var(--navy-900)", display: "block" }}>
            Aravind &amp; Associates
          </strong>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Smart Associate • Validating Secure Session...
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary-blue)", fontSize: "13px", marginTop: "8px" }}>
          <Loader2 size={18} className="spin" style={{ animation: "spin 1s linear infinite" }} />
          <span>Verifying credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect to /login and preserve requested path
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role-Based Access Control (if allowedRoles specified)
  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return (
      <main className="diagnostic-page">
        <section className="diagnostic-card" style={{ textAlign: "center", alignItems: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert size={28} />
          </div>

          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--navy-900)" }}>
              Access Restricted
            </h1>
            <p style={{ fontSize: "13.5px", color: "var(--text-muted)", marginTop: "6px" }}>
              Your account role (<strong>{user?.role || "staff"}</strong>) does not have
              permission to access this module.
            </p>
          </div>

          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg-subtle)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              fontSize: "12px",
              color: "var(--text-body)",
              width: "100%",
              textAlign: "left",
            }}
          >
            <div>Required role(s): <strong>{allowedRoles.join(", ")}</strong></div>
            <div>Current role: <strong>{user?.role || "None"}</strong></div>
            <div style={{ marginTop: "4px", color: "var(--text-muted)" }}>
              Contact your practice administrator to request elevated permissions.
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <Link to="/dashboard" className="btn btn-primary">
              <ArrowLeft size={15} />
              <span>Return to Staff Dashboard</span>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // 4. Authenticated & Authorized: Render route content
  return children;
}
