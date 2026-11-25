import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Where to redirect after login (preserve requested URL or default to /dashboard)
  const from = location.state?.from?.pathname || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!userId.trim()) {
      setError("Please enter your User ID.");
      return;
    }

    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await login(userId.trim(), password);

      if (result.success) {
        // Successful login, navigate to destination
        navigate(from, { replace: true });
      } else {
        setError(result.error || "Invalid email or password.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page-wrap">
      {/* LEFT BRANDING PANEL */}
      <div className="login-brand-panel">
        <div className="login-panel-header">
          <div className="brand-emblem brand-emblem-logo">
            <img src="/smart-audit-circle.png" alt="" className="brand-emblem-image" />
          </div>
          <div>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>Aravind &amp; Associates</span>
            <span style={{ display: "block", fontSize: "11px", color: "#93c5fd" }}>Chartered Accountants</span>
          </div>
        </div>

        <div className="login-panel-content">
          <span className="login-panel-tag">INTERNAL ASSOCIATE PORTAL</span>
          <h1>
            Secure Staff &amp;
            <br />
            <span>Practice Management</span>
          </h1>
          <p>
            Welcome to the centralized workspace for Aravind &amp; Associates staff.
            Sign in to submit your daily attendance, manage client tax filings, and collaborate with your audit teams.
          </p>

          <div className="login-security-features">
            <div className="security-feature-item">
              <div className="security-check-icon">
                <CheckCircle2 size={14} />
              </div>
              <span>256-bit Encrypted Session &amp; JWT Authentication</span>
            </div>
            <div className="security-feature-item">
              <div className="security-check-icon">
                <CheckCircle2 size={14} />
              </div>
              <span>Confidential Client Workpapers &amp; Timesheets</span>
            </div>
            <div className="security-feature-item">
              <div className="security-check-icon">
                <CheckCircle2 size={14} />
              </div>
              <span>Live Attendance &amp; Working Hours Logging</span>
            </div>
          </div>
        </div>

        <div className="login-panel-footer">
          <span>&copy; {new Date().getFullYear()} Aravind &amp; Associates</span>
          <span>System Status: Operational</span>
        </div>
      </div>

      {/* RIGHT LOGIN FORM PANEL */}
      <main className="login-form-panel">
        <section className="login-card-container">
          <div className="login-card-header">
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary-blue)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <ShieldCheck size={15} />
              <span>Staff Authentication</span>
            </div>
            <h2>Member Sign In</h2>
            <p>Enter your User ID and password to access the staff portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label htmlFor="user-id" className="form-label">
                User ID
              </label>
              <input
                id="user-id"
                type="text"
                className="form-input"
                placeholder="Enter your staff User ID"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <div className="form-label">
                <label htmlFor="password">Password</label>
              </div>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon-left" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="login-alert-error">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: "4px" }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Staff Portal</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ textAlign: "center", paddingTop: "8px" }}>
            <Link to="/" className="back-to-home-link">
              ← Return to Practice Homepage
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
