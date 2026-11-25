import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import {
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  RotateCw,
  Building2,
  ArrowLeft,
  ShieldCheck,
  Cpu
} from "lucide-react";

function BackendTest() {
  const [result, setResult] = useState({
    loading: true,
    message: "Connecting to FastAPI backend server...",
    success: false,
    latency: null,
  });

  const testConnection = () => {
    setResult({
      loading: true,
      message: "Testing connection to the configured API server...",
      success: false,
      latency: null,
    });

    const startTime = performance.now();

    api
      .get("/api/health")
      .then((response) => {
        const endTime = performance.now();
        setResult({
          loading: false,
          message:
            response.data.message ||
            `${response.data.service || "Smart Associate Backend"} is online and responding.`,
          success: true,
          latency: Math.round(endTime - startTime),
        });
      })
      .catch((error) => {
        setResult({
          loading: false,
          message:
            error.message +
            ". Check the FastAPI URL configured for this deployment.",
          success: false,
          latency: null,
        });
      });
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <main className="diagnostic-page">
      <section className="diagnostic-card">
        <div className="diagnostic-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="brand-emblem" style={{ width: 34, height: 34 }}>
              <Building2 size={18} />
            </div>
            <div>
              <strong style={{ fontSize: "14px", color: "var(--navy-900)" }}>
                Aravind &amp; Associates
              </strong>
              <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                Smart Associate • System Diagnostics
              </span>
            </div>
          </div>

          <span
            className={`diagnostic-status-pill ${
              result.loading ? "loading" : result.success ? "online" : "offline"
            }`}
          >
            {result.loading ? "Testing..." : result.success ? "System Online" : "Connection Failed"}
          </span>
        </div>

        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--navy-900)", marginBottom: "4px" }}>
            Backend API Health &amp; Integration Check
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Validating real-time CORS connectivity between the Vite frontend and FastAPI server.
          </p>
        </div>

        <div className="diagnostic-details-box">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            {result.loading ? (
              <Activity size={16} color="var(--primary-blue)" />
            ) : result.success ? (
              <CheckCircle2 size={16} color="var(--success)" />
            ) : (
              <XCircle size={16} color="var(--danger)" />
            )}
            <span style={{ fontWeight: 600 }}>
              {result.loading
                ? "Connecting..."
                : result.success
                ? "API Handshake Successful"
                : "Handshake Error"}
            </span>
            {result.latency !== null && (
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
                Latency: {result.latency}ms
              </span>
            )}
          </div>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{result.message}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingTop: "8px" }}>
          <button
            onClick={testConnection}
            className="btn btn-primary btn-sm"
            disabled={result.loading}
          >
            <RotateCw size={14} className={result.loading ? "spin" : ""} />
            <span>{result.loading ? "Testing..." : "Retest Connection"}</span>
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">
              Staff Dashboard
            </Link>
            <Link to="/" className="btn btn-secondary btn-sm">
              <ArrowLeft size={13} />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default BackendTest;
