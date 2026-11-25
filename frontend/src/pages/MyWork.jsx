import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Plus, Search, Calendar, CheckCircle2, Clock, AlertCircle, X, RefreshCw } from "lucide-react";
import api, { getApiErrorMessage } from "../services/api";
import { useAuth } from "../context/AuthContext";

const emptyForm = { title: "", description: "", category: "GST", priority: "Medium", assigned_to: "", due_date: "" };

function currentLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function MyWork() {
  const { user, isManager, isAdmin } = useAuth();
  const canManage = isManager || isAdmin || ["chief auditor", "chief_auditor"].includes(user?.role?.toLowerCase());
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 });
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState({ status: "", category: "", priority: "", search: "" });
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [workLogs, setWorkLogs] = useState([]);
  const [workLogError, setWorkLogError] = useState("");
  const [workLogSaving, setWorkLogSaving] = useState(false);
  const [isWorkLogOpen, setIsWorkLogOpen] = useState(false);
  const [workLogForm, setWorkLogForm] = useState(() => ({
    work_date: currentLocalDate(),
    description: "",
    minutes_spent: "",
    task_id: "",
  }));

  const loadTasks = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = { sort_by: sortBy, limit: 200 };
      if (filter.status) params.status = filter.status;
      if (filter.category) params.category = filter.category;
      if (filter.priority) params.priority = filter.priority;
      if (filter.search.trim()) params.search = filter.search.trim();
      const [taskResponse, summaryResponse] = await Promise.all([api.get("/api/tasks", { params }), api.get("/api/tasks/summary")]);
      setTasks(taskResponse.data.tasks || []); setSummary(summaryResponse.data);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [filter, sortBy]);

  // The loader starts an async request and updates state when it resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTasks(); }, [loadTasks]);
  const loadWorkLogs = useCallback(async () => {
    setWorkLogError("");
    try {
      const response = await api.get("/api/work-logs", { params: { limit: 50 } });
      setWorkLogs(response.data.records || []);
    } catch (err) {
      setWorkLogError(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => { loadWorkLogs(); }, [loadWorkLogs]);

  useEffect(() => {
    if (!canManage) return;
    api.get("/api/tasks/assignees").then((res) => setEmployees(res.data.employees || [])).catch(() => setEmployees([]));
  }, [canManage]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));
  const filteredTasks = useMemo(() => tasks, [tasks]);

  const submitTask = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api.post("/api/tasks", { ...form, assigned_to: Number(form.assigned_to), description: form.description || null, due_date: form.due_date || null });
      setForm(emptyForm); setIsAddModalOpen(false); await loadTasks();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const submitWorkLog = async (event) => {
    event.preventDefault();
    setWorkLogSaving(true);
    setWorkLogError("");
    try {
      await api.post("/api/work-logs", {
        work_date: workLogForm.work_date,
        description: workLogForm.description.trim(),
        minutes_spent: workLogForm.minutes_spent ? Number(workLogForm.minutes_spent) : null,
        task_id: workLogForm.task_id ? Number(workLogForm.task_id) : null,
      });
      setWorkLogForm({
        work_date: currentLocalDate(),
        description: "",
        minutes_spent: "",
        task_id: "",
      });
      setIsWorkLogOpen(false);
      await loadWorkLogs();
    } catch (err) {
      setWorkLogError(getApiErrorMessage(err));
    } finally {
      setWorkLogSaving(false);
    }
  };

  const setStatus = async (task, nextStatus) => {
    const previous = tasks;
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    try { await api.patch(`/api/tasks/${task.id}/status`, { status: nextStatus }); await loadTasks(); }
    catch (err) { setTasks(previous); setError(getApiErrorMessage(err)); }
  };

  const cards = [
    { label: "Total Tasks", value: summary.total, icon: CheckSquare, tone: "blue" },
    { label: "Pending", value: summary.pending, icon: AlertCircle, tone: "purple" },
    { label: "In Progress", value: summary.in_progress, icon: Clock, tone: "amber" },
    { label: "Completed", value: summary.completed, icon: CheckCircle2, tone: "emerald" },
    { label: "Overdue", value: summary.overdue, icon: Calendar, tone: "red" },
  ];

  const categoryStyle = (category) => ({ GST: ["var(--primary-light)", "var(--primary-blue)"], TDS: ["var(--purple-bg)", "var(--purple)"], Audit: ["var(--success-bg)", "var(--success)"], Accounting: ["var(--info-bg)", "var(--info)"] }[category] || ["var(--bg-subtle)", "var(--text-body)"]);

  return <div className="my-work-page">
    <div className="module-header">
      <div className="module-title">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary-blue)", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}><CheckSquare size={13} /><span>PRACTICE WORK TRACKER</span></div>
        <h1>My Work &amp; Client Engagements</h1><p>Track assigned practice work, deadlines, and progress.</p>
      </div>
      <div className="work-header-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setIsWorkLogOpen((open) => !open)}>
          <Clock size={16} /><span>{isWorkLogOpen ? "Close work log" : "Log work"}</span>
        </button>
        {canManage && <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}><Plus size={16} /><span>New Task</span></button>}
      </div>
    </div>

    <div className="stats-grid-4 task-summary-grid" style={{ marginBottom: 24 }}>
      {cards.map(({ label, value, icon: Icon, tone }) => <div className="stat-metric-card" key={label}><div className={`stat-metric-icon ${tone}`}><Icon size={22} /></div><div className="stat-metric-details"><span className="label">{label}</span><strong className="value">{value}</strong><span className="subtext">Live from task records</span></div></div>)}
    </div>

    {isWorkLogOpen && (
      <form className="work-log-entry-card" onSubmit={submitWorkLog}>
        <div className="work-log-entry-heading">
          <div>
            <h2>Record completed work</h2>
            <p>Add a dated work note to your audit trail. Entries are retained for reporting.</p>
          </div>
        </div>
        {workLogError && <div className="task-error" role="alert">{workLogError}</div>}
        <div className="work-log-form-grid">
          <label className="form-group">
            <span className="form-label">Work date</span>
            <input className="form-input" type="date" value={workLogForm.work_date} max={currentLocalDate()} onChange={(event) => setWorkLogForm((current) => ({ ...current, work_date: event.target.value }))} required />
          </label>
          <label className="form-group">
            <span className="form-label">Time spent <span className="staff-admin-optional">Optional</span></span>
            <input className="form-input" type="number" min="1" max="1440" placeholder="Minutes" value={workLogForm.minutes_spent} onChange={(event) => setWorkLogForm((current) => ({ ...current, minutes_spent: event.target.value }))} />
          </label>
          <label className="form-group">
            <span className="form-label">Related task <span className="staff-admin-optional">Optional</span></span>
            <select className="form-input" value={workLogForm.task_id} onChange={(event) => setWorkLogForm((current) => ({ ...current, task_id: event.target.value }))}>
              <option value="">No task selected</option>
              {tasks.filter((task) => task.assigned_to === user?.id).map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </label>
          <label className="form-group work-log-description-field">
            <span className="form-label">Work completed</span>
            <textarea className="form-input task-description-input" value={workLogForm.description} onChange={(event) => setWorkLogForm((current) => ({ ...current, description: event.target.value }))} minLength={3} maxLength={2000} placeholder="Summarize the work you completed today..." required />
          </label>
        </div>
        <div className="work-log-entry-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setIsWorkLogOpen(false)} disabled={workLogSaving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={workLogSaving}>
            {workLogSaving ? <RefreshCw className="spin" size={15} /> : <CheckCircle2 size={15} />}
            <span>{workLogSaving ? "Saving..." : "Save work log"}</span>
          </button>
        </div>
      </form>
    )}

    <div className="work-filter-bar task-filters">
      <div className="search-input-wrap"><Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-subtle)" }} /><input className="search-input" placeholder="Search tasks or descriptions..." value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} /></div>
      <select className="form-input task-filter-select" aria-label="Filter by status" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}><option value="">All statuses</option><option>Pending</option><option>In Progress</option><option>Completed</option></select>
      <select className="form-input task-filter-select" aria-label="Filter by category" value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}><option value="">All categories</option><option>GST</option><option>TDS</option><option>Audit</option><option>Accounting</option></select>
      <select className="form-input task-filter-select" aria-label="Filter by priority" value={filter.priority} onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value }))}><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select>
      <select className="form-input task-filter-select" aria-label="Sort tasks" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">Newest</option><option value="upcoming">Upcoming</option><option value="overdue">Overdue</option></select>
    </div>
    {error && <div className="task-error" role="alert">{error}<button className="btn btn-secondary" onClick={loadTasks}><RefreshCw size={14} /> Retry</button></div>}
    <div className="tasks-list-container">
      {loading ? <div className="task-state">Loading your tasks…</div> : filteredTasks.map((task) => {
        const [bg, color] = categoryStyle(task.category);
        const nextStatus = task.status === "Pending" ? "In Progress" : task.status === "In Progress" ? "Completed" : "Pending";
        return <article key={task.id} className="task-card-item">
          <div className="task-card-left"><div className="task-category-avatar" style={{ background: bg, color }}>{task.category.slice(0, 3)}</div><div className="task-card-details"><h3>{task.title}</h3><p className="task-description">{task.description || "No additional details"}</p><div className="task-meta-line"><span>{task.category}</span><span>Assigned to {task.assignee?.name || "Unknown"}</span>{task.assigner && <span>By {task.assigner.name}</span>}</div></div></div>
          <div className="task-card-right"><span className={`badge ${task.priority === "High" ? "badge-red" : task.priority === "Medium" ? "badge-amber" : "badge-slate"}`}>{task.priority} Priority</span><button type="button" className="task-status-button" onClick={() => setStatus(task, nextStatus)} title={`Advance status to ${nextStatus}`}><span className={`badge ${task.status === "Completed" ? "badge-green" : task.status === "In Progress" ? "badge-blue" : "badge-amber"}`}>{task.status} ↻</span></button><div className="due-date-pill"><Calendar size={14} color="var(--primary-blue)" /><span>{task.due_date || "No due date"}{task.is_overdue && <b className="overdue-label"> · Overdue</b>}</span></div></div>
        </article>;
      })}
      {!loading && !error && filteredTasks.length === 0 && <div className="task-state"><strong>No tasks found</strong><p>Try another filter or check back after a task is assigned.</p></div>}
    </div>

    <section className="work-log-history">
      <div className="work-log-history-heading">
        <div><h2>Recent work logs</h2><p>Daily notes you have recorded</p></div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadWorkLogs}><RefreshCw size={14} /> Refresh</button>
      </div>
      {workLogError && !isWorkLogOpen && <div className="task-error" role="alert">{workLogError}<button type="button" className="btn btn-secondary btn-sm" onClick={loadWorkLogs}>Retry</button></div>}
      {workLogs.length === 0 && !workLogError ? (
        <div className="task-state">No work logs yet. Record completed work to keep your daily audit trail up to date.</div>
      ) : (
        <div className="work-log-list">
          {workLogs.map((entry) => (
            <article key={entry.id} className="work-log-item">
              <div className="work-log-date">{entry.work_date}</div>
              <div className="work-log-item-content">
                <p>{entry.description}</p>
                <div className="task-meta-line">
                  {entry.task_title && <span>{entry.task_title}</span>}
                  {entry.minutes_spent && <span>{entry.minutes_spent} minutes</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>

    {isAddModalOpen && <div className="modal-overlay" onClick={() => !saving && setIsAddModalOpen(false)}><div className="modal-dialog" onClick={(e) => e.stopPropagation()}><div className="modal-header"><h2>Assign a Task</h2><button className="modal-close-btn" onClick={() => setIsAddModalOpen(false)} aria-label="Close"><X size={18} /></button></div><form onSubmit={submitTask}><div className="modal-body">
      <div className="form-group"><label className="form-label" htmlFor="task-title">Task title</label><input id="task-title" className="form-input" minLength={3} maxLength={200} value={form.title} onChange={(e) => setField("title", e.target.value)} required /></div>
      <div className="form-group"><label className="form-label" htmlFor="task-description">Description</label><textarea id="task-description" className="form-input task-description-input" maxLength={1000} value={form.description} onChange={(e) => setField("description", e.target.value)} /></div>
      <div className="form-group"><label className="form-label" htmlFor="task-assignee">Assign to</label><select id="task-assignee" className="form-input" value={form.assigned_to} onChange={(e) => setField("assigned_to", e.target.value)} required><option value="">Choose an employee</option>{employees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select>{employees.length === 0 && <small>No eligible employees are available.</small>}</div>
      <div className="task-form-grid"><div className="form-group"><label className="form-label" htmlFor="task-category">Category</label><select id="task-category" className="form-input" value={form.category} onChange={(e) => setField("category", e.target.value)}><option>GST</option><option>TDS</option><option>Audit</option><option>Accounting</option></select></div><div className="form-group"><label className="form-label" htmlFor="task-priority">Priority</label><select id="task-priority" className="form-input" value={form.priority} onChange={(e) => setField("priority", e.target.value)}><option>High</option><option>Medium</option><option>Low</option></select></div></div>
      <div className="form-group"><label className="form-label" htmlFor="task-due">Due date</label><input id="task-due" className="form-input" type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} /></div>
    </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving || employees.length === 0}><Plus size={15} /><span>{saving ? "Assigning…" : "Assign Task"}</span></button></div></form></div></div>}
  </div>;
}

export default MyWork;
