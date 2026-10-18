import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import Attendance from "./Attendance";
import MyWork from "./MyWork";
import TeamChat from "./TeamChat";
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  MessageSquare,
  Activity,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  Bell,
  ArrowRight,
  CheckCircle2,
  Check,
  AlertCircle,
  TrendingUp,
  FileText,
  ShieldCheck,
  UserCheck
} from "lucide-react";

function StaffDashboard({ initialTab = "Dashboard" }) {
  const { user, logout, role, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const [activeMenu, setActiveMenu] = useState(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Real today attendance state from database
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadTodayAttendance() {
      try {
        const res = await api.get("/api/attendance/today");
        if (isMounted) {
          setTodayAttendance(res.data);
        }
      } catch (err) {
        console.error("Failed to load today's attendance in dashboard:", err);
      } finally {
        if (isMounted) {
          setAttendanceLoading(false);
        }
      }
    }

    if (activeMenu === "Dashboard") {
      loadTodayAttendance();
    }

    return () => {
      isMounted = false;
    };
  }, [activeMenu]);

  useEffect(() => {
    if (initialTab) {
      setActiveMenu(initialTab);
    }
  }, [initialTab]);

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Attendance", icon: Clock },
    { name: "My Work", icon: CheckSquare },
    { name: "Team Chat", icon: MessageSquare },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const getInitials = (name) => {
    if (!name) return "SA";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatRoleTitle = (r) => {
    if (!r) return "Associate";
    switch (r.toLowerCase()) {
      case "admin":
        return "Practice Partner / Admin";
      case "manager":
        return "Audit & Tax Manager";
      case "staff":
      default:
        return "Tax & Audit Associate";
    }
  };

  const displayName = user?.name || "Staff Member";
  const displayRole = formatRoleTitle(user?.role);
  const firstName = displayName.split(" ")[0];

  const renderContent = () => {
    if (activeMenu === "Attendance") {
      return <Attendance />;
    }

    if (activeMenu === "My Work") {
      return <MyWork />;
    }

    if (activeMenu === "Team Chat") {
      return <TeamChat />;
    }

    // Default "Dashboard" overview
    return (
      <div className="dashboard-overview-container">
        {/* WELCOME BANNER */}
        <div className="overview-header">
          <div className="overview-greeting">
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary-blue)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>
              <Building2 size={13} />
              <span>Aravind &amp; Associates • Staff Portal</span>
            </div>
            <h1>Good morning, {firstName}</h1>
            <p>
              Here is your practice workload, statutory filings, and attendance status for today.
            </p>
          </div>

          <div className="overview-header-status">
            <span
              className={`badge ${
                todayAttendance?.checked_out
                  ? "badge-slate"
                  : todayAttendance?.checked_in
                  ? "badge-green"
                  : "badge-amber"
              }`}
            >
              <span
                className="live-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background:
                    todayAttendance?.checked_out
                      ? "var(--text-muted)"
                      : todayAttendance?.checked_in
                      ? "var(--success)"
                      : "var(--warning)",
                }}
              ></span>
              {attendanceLoading
                ? "Checking attendance..."
                : todayAttendance?.checked_out
                ? `Checked Out: ${todayAttendance.record?.check_out_time}`
                : todayAttendance?.checked_in
                ? `Checked In: ${todayAttendance.record?.check_in_time}`
                : "Not Checked In Today"}
            </span>
          </div>
        </div>

        {/* 4 STATISTIC METRIC CARDS */}
        <section className="stats-grid-4">
          <div className="stat-metric-card">
            <div className="stat-metric-icon blue">
              <CheckCircle2 size={24} />
            </div>
            <div className="stat-metric-details">
              <span className="label">Today's Attendance</span>
              <strong
                className="value"
                style={{
                  color: todayAttendance?.checked_in ? "var(--success)" : "var(--text-muted)",
                }}
              >
                {attendanceLoading
                  ? "..."
                  : todayAttendance?.checked_out
                  ? "Completed"
                  : todayAttendance?.checked_in
                  ? todayAttendance.record?.status_display || "Present"
                  : "Not Checked In"}
              </strong>
              <span className="subtext">
                {todayAttendance?.checked_out
                  ? `Checked out at ${todayAttendance.record?.check_out_time}`
                  : todayAttendance?.checked_in
                  ? `Punched in at ${todayAttendance.record?.check_in_time}`
                  : "Check in via Attendance tab"}
              </span>
            </div>
          </div>

          <div className="stat-metric-card">
            <div className="stat-metric-icon purple">
              <Clock size={24} />
            </div>
            <div className="stat-metric-details">
              <span className="label">Working Hours</span>
              <strong className="value">
                {attendanceLoading
                  ? "..."
                  : todayAttendance?.record?.duration_formatted || "0h 00m"}
              </strong>
              <span className="subtext">
                {todayAttendance?.checked_out
                  ? "Workday duration completed"
                  : todayAttendance?.checked_in
                  ? "Active billable session"
                  : "Session not started"}
              </span>
            </div>
          </div>

          <div className="stat-metric-card">
            <div className="stat-metric-icon amber">
              <CheckSquare size={24} />
            </div>
            <div className="stat-metric-details">
              <span className="label">Engagements Today</span>
              <strong className="value">8 Tasks</strong>
              <span className="subtext">3 completed • 2 due today</span>
            </div>
          </div>

          <div className="stat-metric-card">
            <div className="stat-metric-icon emerald">
              <MessageSquare size={24} />
            </div>
            <div className="stat-metric-details">
              <span className="label">Team Messages</span>
              <strong className="value">4 Unread</strong>
              <span className="subtext">From Audit Lead (Priya)</span>
            </div>
          </div>
        </section>

        {/* SPLIT SECTION: ASSIGNED TASKS & ATTENDANCE SUMMARY */}
        <section className="dashboard-split-grid">
          {/* TODAY'S WORK CARD */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <h2>Today's Work &amp; Filings</h2>
                <p>Prioritized client engagements assigned to you.</p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveMenu("My Work")}
              >
                <span>View All Engagements</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="panel-card-body">
              {/* Task 1 */}
              <div className="task-item-row">
                <div className="task-item-main">
                  <div className="task-check-circle"></div>
                  <div className="task-titles">
                    <strong>Prepare GST Filing Documents (GSTR-3B)</strong>
                    <span>Client: ABC Enterprises • GST Compliance</span>
                  </div>
                </div>

                <div className="task-item-meta">
                  <span className="badge badge-red">High</span>
                  <span className="badge badge-amber">In Progress</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
                    05 Oct 2026
                  </span>
                </div>
              </div>

              {/* Task 2 */}
              <div className="task-item-row">
                <div className="task-item-main">
                  <div className="task-check-circle completed">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div className="task-titles">
                    <strong>Verify Form 26AS &amp; TDS Statements</strong>
                    <span>Client: Raj &amp; Co. • TDS Return</span>
                  </div>
                </div>

                <div className="task-item-meta">
                  <span className="badge badge-amber">Medium</span>
                  <span className="badge badge-green">Completed</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
                    05 Oct 2026
                  </span>
                </div>
              </div>

              {/* Task 3 */}
              <div className="task-item-row">
                <div className="task-item-main">
                  <div className="task-check-circle"></div>
                  <div className="task-titles">
                    <strong>Update Client Ledger &amp; Journal Entries</strong>
                    <span>Client: Kumar Industries • Accounting Audit</span>
                  </div>
                </div>

                <div className="task-item-meta">
                  <span className="badge badge-slate">Low</span>
                  <span className="badge badge-slate">Pending</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
                    06 Oct 2026
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ATTENDANCE SUMMARY CARD */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <h2>Today's Attendance</h2>
                <p>Biometric punch record &amp; session status.</p>
              </div>
            </div>

            <div className="attendance-summary-card">
              <div
                className="attendance-visual-ring"
                style={{
                  background:
                    todayAttendance?.checked_in
                      ? "var(--success-bg)"
                      : "var(--bg-subtle)",
                  borderColor:
                    todayAttendance?.checked_in
                      ? "var(--success-border)"
                      : "var(--border-color)",
                  color:
                    todayAttendance?.checked_in
                      ? "var(--success)"
                      : "var(--text-muted)",
                }}
              >
                {todayAttendance?.checked_in ? (
                  <Check size={36} strokeWidth={3} />
                ) : (
                  <Clock size={36} />
                )}
              </div>

              <div className="attendance-status-text">
                <h3>
                  {attendanceLoading
                    ? "Loading status..."
                    : todayAttendance?.checked_out
                    ? "Workday Completed"
                    : todayAttendance?.checked_in
                    ? "You are Checked In"
                    : "Not Checked In Yet"}
                </h3>
                <p>
                  {todayAttendance?.checked_out
                    ? `Checked out at ${todayAttendance.record?.check_out_time}. Total: ${todayAttendance.record?.duration_formatted}.`
                    : todayAttendance?.checked_in
                    ? `Punch recorded at ${todayAttendance.record?.check_in_time} • Head Office`
                    : "Punch in on the Attendance Terminal to track working hours."}
                </p>
              </div>

              <div className="attendance-time-pill-grid">
                <div className="time-pill-item">
                  <span>Check In Time</span>
                  <strong>
                    {todayAttendance?.record?.check_in_time || "—"}
                  </strong>
                </div>

                <div className="time-pill-item">
                  <span>
                    {todayAttendance?.checked_out ? "Total Duration" : "Active Session"}
                  </span>
                  <strong style={{ color: "var(--primary-blue)" }}>
                    {todayAttendance?.record?.duration_formatted || "0h 00m"}
                  </strong>
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                style={{ width: "100%" }}
                onClick={() => setActiveMenu("Attendance")}
              >
                <span>Manage Attendance Terminal</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* QUICK ACTION SHORTCUTS */}
        <section className="quick-actions-section">
          <h2>Quick Practice Actions</h2>

          <div className="quick-actions-grid">
            <button
              className="quick-action-button"
              onClick={() => setActiveMenu("My Work")}
            >
              <div className="quick-action-icon" style={{ background: "var(--primary-light)", color: "var(--primary-blue)" }}>
                <CheckSquare size={20} />
              </div>
              <div className="quick-action-text">
                <strong>Log Work Update</strong>
                <span>Update task progress and timesheet</span>
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </button>

            <button
              className="quick-action-button"
              onClick={() => setActiveMenu("Team Chat")}
            >
              <div className="quick-action-icon" style={{ background: "var(--purple-bg)", color: "var(--purple)" }}>
                <MessageSquare size={20} />
              </div>
              <div className="quick-action-text">
                <strong>Open Team Messenger</strong>
                <span>Consult colleagues on audit queries</span>
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </button>

            <button
              className="quick-action-button"
              onClick={() => setActiveMenu("Attendance")}
            >
              <div className="quick-action-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                <Clock size={20} />
              </div>
              <div className="quick-action-text">
                <strong>Attendance Records</strong>
                <span>View monthly biometric timestamps</span>
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </button>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="staff-portal-shell">
      {/* COLLAPSIBLE SIDEBAR */}
      <aside
        className={`portal-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${
          mobileSidebarOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand-wrap">
            <div className="brand-emblem" style={{ width: 34, height: 34 }}>
              <Building2 size={18} />
            </div>
            {!sidebarCollapsed && (
              <div className="brand-titles">
                <span className="brand-firm-name">Aravind &amp; Associates</span>
                <span className="brand-firm-tag">Smart Associate</span>
              </div>
            )}
          </div>

          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* STAFF MEMBER PROFILE IN SIDEBAR */}
        <div className="sidebar-user-card">
          <div className="user-avatar-circle">
            {getInitials(displayName)}
            <span className="status-online-dot"></span>
          </div>
          {!sidebarCollapsed && (
            <div className="user-info-text">
              <strong>{displayName}</strong>
              <span>{displayRole}</span>
            </div>
          )}
        </div>

        {/* SIDEBAR NAVIGATION MENU */}
        <nav className="sidebar-nav">
          {!sidebarCollapsed && (
            <span className="sidebar-section-title">Operations Portal</span>
          )}

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.name;
            return (
              <button
                key={item.name}
                className={`sidebar-nav-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveMenu(item.name);
                  setMobileSidebarOpen(false);
                }}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon size={18} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </button>
            );
          })}

          {!sidebarCollapsed && (
            <span className="sidebar-section-title" style={{ marginTop: "16px" }}>
              System &amp; Diagnostics
            </span>
          )}

          <Link
            to="/backend-test"
            className="sidebar-nav-btn"
            title={sidebarCollapsed ? "Server Diagnostics" : undefined}
          >
            <Activity size={18} />
            {!sidebarCollapsed && <span>API Diagnostics</span>}
          </Link>
        </nav>

        {/* SIDEBAR FOOTER & LOGOUT */}
        <div className="sidebar-footer">
          <button
            className="logout-nav-btn"
            onClick={handleLogout}
            title={sidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={17} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="portal-main-wrapper">
        {/* TOPBAR */}
        <header className="portal-topbar">
          <div className="topbar-left">
            <button
              className="topbar-mobile-toggle"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle Mobile Sidebar"
            >
              {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="topbar-breadcrumb">
              <span>Portal</span>
              <span>/</span>
              <strong>{activeMenu}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-date-pill">
              <Calendar size={14} color="var(--primary-blue)" />
              <span>Monday, 05 October 2026</span>
            </div>

            <div className="topbar-branch-badge">
              <Building2 size={13} />
              <span>Chennai Main Office</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
                title="Notifications"
              >
                <Bell size={16} />
              </div>

              <div
                className="user-avatar-circle"
                style={{ width: 34, height: 34, fontSize: "12px" }}
                title={`${displayName} (${displayRole})`}
              >
                {getInitials(displayName)}
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT VIEWPORT */}
        <main className="portal-content-body">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default StaffDashboard;