import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import api, { getApiErrorMessage } from "../services/api";

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const newAccount = {
  name: "",
  user_id: "",
  email: "",
  password: "",
  role: "staff",
  is_active: true,
};

function AdminStaff() {
  const today = localDate(new Date());
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(newAccount);
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);

  const loadEmployees = useCallback(async () => {
    try {
      const response = await api.get("/api/admin/staff");
      setEmployees(response.data.employees || []);
      setError("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setEmployees]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(newAccount);
    setIsFormOpen(true);
    setError("");
    setNotice("");
  };

  const openEditForm = (account) => {
    setEditingId(account.id);
    setIsFormOpen(true);
    setForm({
      name: account.name,
      user_id: account.user_id || "",
      email: account.email || "",
      password: "",
      role: account.role,
      is_active: account.is_active,
    });
    setError("");
    setNotice("");
  };

  const closeForm = () => {
    if (!saving) {
      setIsFormOpen(false);
      setEditingId(null);
      setForm(newAccount);
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      user_id: form.user_id.trim(),
      role: form.role,
      email: form.email.trim() || null,
    };
    if (form.password) payload.password = form.password;
    if (editingId) payload.is_active = form.is_active;

    try {
      if (editingId) {
        await api.patch(`/api/admin/staff/${editingId}`, payload);
        setNotice("Staff account updated.");
      } else {
        await api.post("/api/admin/staff", payload);
        setNotice("Staff account created.");
      }
      setIsFormOpen(false);
      setEditingId(null);
      setForm(newAccount);
      await loadEmployees();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const exportReport = async (event) => {
    event.preventDefault();
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const response = await api.get("/api/admin/reports.csv", {
        params: { start_date: startDate, end_date: endDate },
        responseType: "blob",
      });
      const downloadUrl = URL.createObjectURL(
        new Blob([response.data], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `staff-audit-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setNotice("Audit report downloaded.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setExporting(false);
    }
  };

  const activeCount = employees.filter((person) => person.is_active).length;
  const refreshEmployees = () => {
    setLoading(true);
    loadEmployees();
  };

  return (
    <div className="staff-admin-page">
      <div className="module-header">
        <div className="module-title">
          <div className="staff-admin-eyebrow">
            <ShieldCheck size={14} />
            <span>ADMINISTRATION</span>
          </div>
          <h1>Staff &amp; Audit Management</h1>
          <p>Manage staff access and export attendance, work logs, and completed tasks.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          <Plus size={16} />
          <span>Add staff account</span>
        </button>
      </div>

      {error && (
        <div className="staff-admin-alert error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadEmployees}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}
      {notice && (
        <div className="staff-admin-alert success" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}

      <section className="staff-admin-report-card">
        <div className="staff-admin-section-heading">
          <div className="staff-admin-section-icon"><Download size={18} /></div>
          <div>
            <h2>Download audit report</h2>
            <p>Includes attendance times and duration, daily work logs, and task completion history.</p>
          </div>
        </div>
        <form className="staff-admin-report-form" onSubmit={exportReport}>
          <label className="form-group">
            <span className="form-label">From</span>
            <input
              className="form-input"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </label>
          <label className="form-group">
            <span className="form-label">Through</span>
            <input
              className="form-input"
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={exporting}>
            {exporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
            <span>{exporting ? "Preparing report..." : "Download CSV report"}</span>
          </button>
        </form>
      </section>

      <section className="staff-admin-accounts-card">
        <div className="staff-admin-section-heading">
          <div className="staff-admin-section-icon"><Users size={18} /></div>
          <div>
            <h2>Staff accounts</h2>
            <p>{activeCount} active of {employees.length} accounts</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm staff-admin-refresh"
            onClick={refreshEmployees}
            disabled={loading}
            aria-label="Refresh staff accounts"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="staff-admin-state"><Loader2 className="spin" size={20} /> Loading staff accounts...</div>
        ) : employees.length === 0 ? (
          <div className="staff-admin-state">No staff accounts found.</div>
        ) : (
          <div className="staff-admin-table-wrap">
            <table className="staff-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((person) => (
                  <tr key={person.id}>
                    <td data-label="Name">
                      <strong>{person.name}</strong>
                      {person.email && <span className="staff-admin-email">{person.email}</span>}
                    </td>
                    <td data-label="User ID"><code>{person.user_id || "—"}</code></td>
                    <td data-label="Role"><span className={`staff-role-badge ${person.role}`}>{person.role}</span></td>
                    <td data-label="Access">
                      <span className={`staff-access-badge ${person.is_active ? "active" : "inactive"}`}>
                        {person.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="staff-admin-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditForm(person)}
                        aria-label={`Edit ${person.name}`}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeForm()}>
          <section className="modal-dialog staff-admin-modal" role="dialog" aria-modal="true" aria-labelledby="staff-form-title">
            <div className="modal-header">
              <div>
                <h2 id="staff-form-title">{editingId ? "Edit staff account" : "Create staff account"}</h2>
                <p>User IDs and passwords are managed by an administrator.</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={closeForm} aria-label="Close" disabled={saving}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveAccount}>
              <div className="modal-body staff-admin-form-grid">
                <label className="form-group">
                  <span className="form-label">Full name</span>
                  <input className="form-input" value={form.name} onChange={(event) => updateField("name", event.target.value)} minLength={2} maxLength={100} required />
                </label>
                <label className="form-group">
                  <span className="form-label">User ID</span>
                  <input className="form-input" value={form.user_id} onChange={(event) => updateField("user_id", event.target.value)} minLength={3} maxLength={50} pattern="[A-Za-z0-9](?:[A-Za-z0-9._]|-)*" autoComplete="off" required />
                </label>
                <label className="form-group">
                  <span className="form-label">Role</span>
                  <select className="form-input" value={form.role} onChange={(event) => updateField("role", event.target.value)}>
                    <option value="staff">Staff</option>
                    {editingId && form.role === "manager" && <option value="manager">Manager (existing)</option>}
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Email <span className="staff-admin-optional">Optional</span></span>
                  <input className="form-input" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} maxLength={255} autoComplete="email" />
                </label>
                <label className="form-group staff-admin-password-field">
                  <span className="form-label">{editingId ? "New password" : "Password"}</span>
                  <input
                    className="form-input"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder={editingId ? "Leave blank to keep current password" : "At least 10 characters"}
                    required={!editingId}
                  />
                </label>
                {editingId && (
                  <label className="staff-admin-active-toggle">
                    <input type="checkbox" checked={form.is_active} onChange={(event) => updateField("is_active", event.target.checked)} />
                    <span>Account can sign in</span>
                  </label>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving && <Loader2 className="spin" size={15} />}
                  <span>{saving ? "Saving..." : editingId ? "Save changes" : "Create account"}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminStaff;
