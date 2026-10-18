import { useState } from "react";
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Tag
} from "lucide-react";

function MyWork() {
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state for new task
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskClient, setNewTaskClient] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("GST");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskDue, setNewTaskDue] = useState("10 Oct 2026");

  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Prepare GST Filing Documents (GSTR-3B & 1)",
      client: "ABC Enterprises",
      category: "GST",
      priority: "High",
      status: "In Progress",
      due: "05 Oct 2026",
    },
    {
      id: 2,
      title: "Verify Form 26AS & TDS Statements",
      client: "Raj & Co.",
      category: "TDS",
      priority: "Medium",
      status: "Completed",
      due: "05 Oct 2026",
    },
    {
      id: 3,
      title: "Update Client Ledger & Journal Entries",
      client: "Kumar Industries",
      category: "Accounting",
      priority: "Low",
      status: "Pending",
      due: "06 Oct 2026",
    },
    {
      id: 4,
      title: "Compile Individual Income Tax Working Papers",
      client: "Siva Traders",
      category: "Income Tax",
      priority: "High",
      status: "In Progress",
      due: "07 Oct 2026",
    },
    {
      id: 5,
      title: "Statutory Audit Supporting Vouchers Check",
      client: "Green Solutions Pvt Ltd",
      category: "Audit",
      priority: "Medium",
      status: "Pending",
      due: "08 Oct 2026",
    },
  ]);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskClient.trim()) return;

    const newTask = {
      id: Date.now(),
      title: newTaskTitle.trim(),
      client: newTaskClient.trim(),
      category: newTaskCategory,
      priority: newTaskPriority,
      status: "Pending",
      due: newTaskDue,
    };

    setTasks([newTask, ...tasks]);
    setNewTaskTitle("");
    setNewTaskClient("");
    setIsAddModalOpen(false);
  };

  const cycleStatus = (id) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === id) {
          const nextStatus =
            task.status === "Pending"
              ? "In Progress"
              : task.status === "In Progress"
              ? "Completed"
              : "Pending";
          return { ...task, status: nextStatus };
        }
        return task;
      })
    );
  };

  // Metrics
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "Completed").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
  const pendingCount = tasks.filter((t) => t.status === "Pending").length;

  const filteredTasks = tasks.filter((task) => {
    const matchesFilter = filter === "All" || task.status === filter;
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getCategoryColor = (cat) => {
    switch (cat) {
      case "GST":
        return { bg: "var(--primary-light)", color: "var(--primary-blue)" };
      case "TDS":
        return { bg: "var(--purple-bg)", color: "var(--purple)" };
      case "Income Tax":
        return { bg: "var(--info-bg)", color: "var(--info)" };
      case "Audit":
        return { bg: "var(--success-bg)", color: "var(--success)" };
      default:
        return { bg: "var(--bg-subtle)", color: "var(--text-body)" };
    }
  };

  return (
    <div className="my-work-page">
      <div className="module-header">
        <div className="module-title">
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary-blue)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>
            <CheckSquare size={13} />
            <span>PRACTICE WORK TRACKER</span>
          </div>
          <h1>My Work &amp; Client Engagements</h1>
          <p>Assigned audit, GST compliance, tax filings, and partner review queues.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} />
          <span>New Engagement Task</span>
        </button>
      </div>

      {/* STATS OVERVIEW */}
      <div className="stats-grid-4" style={{ marginBottom: "24px" }}>
        <div className="stat-metric-card">
          <div className="stat-metric-icon blue">
            <CheckSquare size={22} />
          </div>
          <div className="stat-metric-details">
            <span className="label">Total Tasks</span>
            <strong className="value">{totalCount}</strong>
            <span className="subtext">Assigned engagements</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-icon emerald">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-metric-details">
            <span className="label">Completed</span>
            <strong className="value" style={{ color: "var(--success)" }}>
              {completedCount}
            </strong>
            <span className="subtext">Partner approved</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-icon amber">
            <Clock size={22} />
          </div>
          <div className="stat-metric-details">
            <span className="label">In Progress</span>
            <strong className="value" style={{ color: "var(--warning)" }}>
              {inProgressCount}
            </strong>
            <span className="subtext">Active drafting</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-icon purple">
            <AlertCircle size={22} />
          </div>
          <div className="stat-metric-details">
            <span className="label">Pending Queue</span>
            <strong className="value" style={{ color: "var(--purple)" }}>
              {pendingCount}
            </strong>
            <span className="subtext">Action required</span>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="work-filter-bar">
        <div className="search-input-wrap">
          <Search size={16} style={{ position: "absolute", left: "12px", color: "var(--text-subtle)" }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by client, filing, or tax type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills-row">
          {["All", "Pending", "In Progress", "Completed"].map((status) => (
            <button
              key={status}
              className={`filter-pill-btn ${filter === status ? "active" : ""}`}
              onClick={() => setFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* TASKS LIST */}
      <div className="tasks-list-container">
        {filteredTasks.map((task) => {
          const catStyle = getCategoryColor(task.category);
          return (
            <div key={task.id} className="task-card-item">
              <div className="task-card-left">
                <div
                  className="task-category-avatar"
                  style={{ background: catStyle.bg, color: catStyle.color }}
                >
                  {task.category.slice(0, 3)}
                </div>

                <div className="task-card-details">
                  <h3>{task.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                    <span style={{ fontWeight: 600, color: "var(--navy-900)" }}>
                      {task.client}
                    </span>
                    <span>•</span>
                    <span style={{ color: "var(--text-muted)" }}>{task.category}</span>
                  </div>
                </div>
              </div>

              <div className="task-card-right">
                <span
                  className={`badge ${
                    task.priority === "High"
                      ? "badge-red"
                      : task.priority === "Medium"
                      ? "badge-amber"
                      : "badge-slate"
                  }`}
                >
                  {task.priority} Priority
                </span>

                <button
                  type="button"
                  onClick={() => cycleStatus(task.id)}
                  title="Click to advance status"
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <span
                    className={`badge ${
                      task.status === "Completed"
                        ? "badge-green"
                        : task.status === "In Progress"
                        ? "badge-blue"
                        : "badge-amber"
                    }`}
                  >
                    {task.status} ↻
                  </span>
                </button>

                <div className="due-date-pill">
                  <Calendar size={14} color="var(--primary-blue)" />
                  <span>{task.due}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", background: "#ffffff", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "15px", fontWeight: 600 }}>No engagements found</p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Try adjusting your search criteria or add a new engagement task.
            </p>
          </div>
        )}
      </div>

      {/* ADD WORK MODAL DIALOG */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Engagement Task</h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task / Engagement Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Audit Verification for XYZ Pvt Ltd"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    required
                    style={{ paddingLeft: "14px" }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Client Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ABC Enterprises"
                    value={newTaskClient}
                    onChange={(e) => setNewTaskClient(e.target.value)}
                    required
                    style={{ paddingLeft: "14px" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value)}
                      style={{ paddingLeft: "14px", height: "44px" }}
                    >
                      <option value="GST">GST Filing</option>
                      <option value="TDS">TDS Return</option>
                      <option value="Income Tax">Income Tax</option>
                      <option value="Audit">Audit Review</option>
                      <option value="Accounting">Accounting / Bookkeeping</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-input"
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      style={{ paddingLeft: "14px", height: "44px" }}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    placeholder="e.g. 15 Oct 2026"
                    style={{ paddingLeft: "14px" }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={15} />
                  <span>Assign Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyWork;