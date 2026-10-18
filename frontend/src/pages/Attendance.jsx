import { useState, useEffect, useCallback } from "react";
import api, { getApiErrorMessage } from "../services/api";
import {
  Clock,
  CheckCircle2,
  Calendar,
  Download,
  Filter,
  Check,
  Building2,
  AlertCircle,
  Loader2,
  RotateCw,
  XCircle,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";

function Attendance() {
  // State for today's status
  const [todayData, setTodayData] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  // State for monthly summary
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // State for history table
  const [records, setRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Action submission state
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /**
   * Fetch today's real attendance status from backend
   */
  const fetchTodayStatus = useCallback(async () => {
    try {
      setTodayLoading(true);
      const res = await api.get("/api/attendance/today");
      setTodayData(res.data);
    } catch (err) {
      console.error("Failed to load today's attendance status:", err);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  /**
   * Fetch monthly attendance summary from backend
   */
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await api.get("/api/attendance/summary");
      setSummaryData(res.data);
    } catch (err) {
      console.error("Failed to load attendance summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  /**
   * Fetch attendance history with active filters from backend
   */
  const fetchHistory = useCallback(async (start = startDate, end = endDate, st = statusFilter) => {
    try {
      setHistoryLoading(true);
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      if (st) params.status = st;

      const res = await api.get("/api/attendance/history", { params });
      setRecords(res.data.records || []);
    } catch (err) {
      console.error("Failed to load attendance history:", err);
      setNotification({
        type: "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [startDate, endDate, statusFilter]);

  // Initial data load on mount
  useEffect(() => {
    fetchTodayStatus();
    fetchSummary();
    fetchHistory();
  }, [fetchTodayStatus, fetchSummary, fetchHistory]);

  /**
   * Handles check-in submission
   */
  const handleCheckIn = async () => {
    setSubmitting(true);
    setNotification(null);

    try {
      const res = await api.post("/api/attendance/check-in", {
        notes: "Staff portal check-in",
      });

      setNotification({
        type: "success",
        message: res.data.message || "Check-in recorded successfully!",
      });

      // Refresh real state across components
      await Promise.all([fetchTodayStatus(), fetchSummary(), fetchHistory()]);
    } catch (err) {
      setNotification({
        type: "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handles check-out submission
   */
  const handleCheckOut = async () => {
    setSubmitting(true);
    setNotification(null);

    try {
      const res = await api.post("/api/attendance/check-out", {
        notes: "Staff portal check-out",
      });

      setNotification({
        type: "success",
        message: res.data.message || "Check-out recorded successfully!",
      });

      // Refresh real state across components
      await Promise.all([fetchTodayStatus(), fetchSummary(), fetchHistory()]);
    } catch (err) {
      setNotification({
        type: "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Filter controls
   */
  const handleApplyFilter = (e) => {
    e.preventDefault();
    fetchHistory(startDate, endDate, statusFilter);
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("");
    fetchHistory("", "", "");
  };

  /**
   * Generates a real CSV download from the currently loaded database records
   */
  const handleExportCSV = () => {
    if (!records.length) {
      setNotification({
        type: "error",
        message: "No attendance records available to export.",
      });
      return;
    }

    const headers = ["Date", "Check In", "Check Out", "Total Duration", "Status", "Notes"];
    const rows = records.map((r) => [
      r.date,
      r.check_in_time,
      r.check_out_time,
      r.duration_formatted,
      r.status_display,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `Aravind_Associates_Attendance_${summaryData?.month || "Export"}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotification({
      type: "success",
      message: `Export completed: ${filename} generated successfully.`,
    });
  };

  // Derived today status properties
  const isCheckedIn = Boolean(todayData?.checked_in);
  const isCheckedOut = Boolean(todayData?.checked_out);
  const activeRecord = todayData?.record;

  return (
    <div className="attendance-page">
      {/* MODULE HEADER */}
      <div className="module-header">
        <div className="module-title">
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary-blue)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>
            <Clock size={13} />
            <span>PRACTICE ATTENDANCE</span>
          </div>
          <h1>Staff Attendance Terminal</h1>
          <p>
            Record biometric &amp; digital punch times, track billable duration, and view verified timesheet logs.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={historyLoading || records.length === 0}
            title="Download verified attendance history as CSV"
          >
            <Download size={15} />
            <span>Export CSV Timesheet</span>
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR NOTIFICATION ALERT */}
      {notification && (
        <div
          role="alert"
          style={{
            padding: "14px 18px",
            background: notification.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
            border: `1px solid ${notification.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
            borderRadius: "var(--radius-md)",
            color: notification.type === "success" ? "var(--success)" : "var(--danger)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "13.5px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {notification.type === "success" ? (
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ATTENDANCE HERO PUNCH CARD */}
      <div className="attendance-hero-card">
        {/* LEFT PUNCH ACTION PANEL */}
        <div className="punch-panel">
          {todayLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "20px" }}>
              <Loader2 size={36} className="spin" color="var(--primary-blue)" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Checking today's attendance record...</span>
            </div>
          ) : (
            <>
              <div
                className={`punch-ring ${
                  isCheckedIn && !isCheckedOut
                    ? "checked-in"
                    : isCheckedOut
                    ? "checked-in"
                    : "checked-out"
                }`}
                style={{
                  background: isCheckedIn && !isCheckedOut ? "var(--primary-light)" : isCheckedOut ? "var(--success-bg)" : "var(--bg-subtle)",
                  borderColor: isCheckedIn && !isCheckedOut ? "var(--primary-border)" : isCheckedOut ? "var(--success-border)" : "var(--border-color)",
                  color: isCheckedIn && !isCheckedOut ? "var(--primary-blue)" : isCheckedOut ? "var(--success)" : "var(--text-muted)",
                }}
              >
                {isCheckedOut ? (
                  <Check size={42} strokeWidth={3} />
                ) : isCheckedIn ? (
                  <Clock size={42} />
                ) : (
                  <Clock size={42} />
                )}
              </div>

              <div className="attendance-status-text">
                <h3>
                  {isCheckedOut
                    ? "Workday Completed"
                    : isCheckedIn
                    ? "You are Checked In"
                    : "Ready to Punch In"}
                </h3>
                <p>
                  {isCheckedOut
                    ? `Checked out at ${activeRecord?.check_out_time}. Total logged time: ${activeRecord?.duration_formatted}.`
                    : isCheckedIn
                    ? `Check-in recorded at ${activeRecord?.check_in_time}. Active practice session in progress.`
                    : "Record your attendance to begin tracking client engagement working hours."}
                </p>
              </div>

              <div className="punch-clock-display">
                {isCheckedIn
                  ? activeRecord?.check_in_time
                  : "-- : --"}
              </div>

              {/* ACTION BUTTON */}
              <div>
                {!isCheckedIn ? (
                  <button
                    className="btn btn-primary btn-lg"
                    style={{ minWidth: "200px" }}
                    onClick={handleCheckIn}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={17} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                        <span>Recording Punch In...</span>
                      </>
                    ) : (
                      <>
                        <Clock size={17} />
                        <span>Punch Check In</span>
                      </>
                    )}
                  </button>
                ) : !isCheckedOut ? (
                  <button
                    className="btn btn-danger btn-lg"
                    style={{ minWidth: "200px" }}
                    onClick={handleCheckOut}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={17} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                        <span>Recording Punch Out...</span>
                      </>
                    ) : (
                      <>
                        <Check size={17} />
                        <span>Punch Check Out</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 18px",
                      background: "var(--success-bg)",
                      color: "var(--success)",
                      borderRadius: "var(--radius-full)",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Attendance Complete for Today</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT SUMMARY METRICS PANEL */}
        <div className="punch-metrics-grid">
          <div className="attendance-metric-box">
            <span>Today's Status</span>
            <strong
              style={{
                color: isCheckedOut ? "var(--navy-900)" : isCheckedIn ? "var(--primary-blue)" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isCheckedOut ? "var(--success)" : isCheckedIn ? "var(--primary-blue)" : "#94a3b8",
                }}
              ></span>
              {todayLoading
                ? "Loading..."
                : isCheckedOut
                ? "Checked Out"
                : isCheckedIn
                ? `${activeRecord?.status_display} (Active)`
                : "Not Punched"}
            </strong>
          </div>

          <div className="attendance-metric-box">
            <span>Session Duration</span>
            <strong style={{ color: "var(--primary-blue)" }}>
              {todayLoading ? "—" : activeRecord?.duration_formatted || "0h 00m"}
            </strong>
          </div>

          <div className="attendance-metric-box">
            <span>Month Days Present</span>
            <strong>
              {summaryLoading ? "..." : `${summaryData?.days_present || 0} Days`}
            </strong>
          </div>

          <div className="attendance-metric-box">
            <span>Month Total Logged</span>
            <strong style={{ color: "var(--navy-900)" }}>
              {summaryLoading ? "..." : summaryData?.total_hours_formatted || "0h 00m"}
            </strong>
          </div>
        </div>
      </div>

      {/* ATTENDANCE HISTORY CARD */}
      <div className="table-card">
        {/* CARD HEADER & FILTER CONTROLS */}
        <div className="table-card-header" style={{ flexDirection: "column", alignItems: "stretch", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--navy-900)" }}>
                Verified Attendance History
              </h2>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                Official timestamp records fetched from the secure database.
              </p>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchHistory()}
              disabled={historyLoading}
              title="Refresh attendance records"
            >
              <RotateCw size={13} className={historyLoading ? "spin" : ""} style={historyLoading ? { animation: "spin 1s linear infinite" } : {}} />
              <span>Refresh</span>
            </button>
          </div>

          {/* DATE RANGE & STATUS FILTER TOOLBAR */}
          <form
            onSubmit={handleApplyFilter}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              padding: "12px 14px",
              background: "var(--bg-subtle)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-body)" }}>From:</span>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ height: "36px", padding: "0 10px", fontSize: "12.5px", width: "145px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-body)" }}>To:</span>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ height: "36px", padding: "0 10px", fontSize: "12.5px", width: "145px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-body)" }}>Status:</span>
              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: "36px", padding: "0 10px", fontSize: "12.5px", width: "130px" }}
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late Arrival</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={historyLoading}>
                <Filter size={13} />
                <span>Filter</span>
              </button>
              {(startDate || endDate || statusFilter) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearFilter}
                  disabled={historyLoading}
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* DATA TABLE */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Total Working Duration</th>
                <th>Status</th>
                <th>Notes / Audit Log</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <Loader2 size={18} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                      <span>Loading attendance history from database...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((record) => (
                  <tr key={record.id}>
                    <td style={{ fontWeight: 600, color: "var(--navy-900)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Calendar size={14} color="var(--primary-blue)" />
                        <span>{record.date_formatted}</span>
                      </div>
                    </td>
                    <td>{record.check_in_time}</td>
                    <td>{record.check_out_time}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--navy-900)" }}>
                        {record.duration_formatted}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          record.status === "present"
                            ? "badge-green"
                            : record.status === "late"
                            ? "badge-amber"
                            : "badge-purple"
                        }`}
                      >
                        {record.status_display}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                      {record.notes || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    <p style={{ fontWeight: 600, fontSize: "14px" }}>No attendance records found</p>
                    <p style={{ fontSize: "12.5px", marginTop: "4px" }}>
                      {startDate || endDate || statusFilter
                        ? "No records match the applied date or status filters. Try resetting the filter."
                        : "No attendance punches have been recorded yet."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Attendance;