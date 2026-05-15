"use client";
import { authFetch } from "@/lib/auth";

import { useEffect, useState } from "react";
import { projects as allProjects } from "@/projects.config";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  projectIds: string[];
  createdAt: string;
}

interface AdminPanelProps {
  apiUrl: string;
  onClose: () => void;
}

const ROLES = ["user", "superadmin"];

function blankForm() {
  return { email: "", password: "", firstName: "", lastName: "", role: "user", projectIds: "" };
}

export default function AdminPanel({ apiUrl, onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state: userId → partial overrides
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminUser & { password: string; projectIdsStr: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${apiUrl}/api/admin/users`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      projectIdsStr: u.projectIds.join(", "),
      password: ""
    });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setSaveError(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        firstName: editForm.firstName ?? "",
        lastName: editForm.lastName ?? "",
        role: editForm.role,
        projectIds: (editForm.projectIdsStr || "").split(",").map(s => s.trim()).filter(Boolean)
      };
      if (editForm.password) body.password = editForm.password;

      const res = await authFetch(`${apiUrl}/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setEditingId(null);
      await loadUsers();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await authFetch(`${apiUrl}/api/admin/users/${id}`, {
        method: "DELETE",
      });
      await loadUsers();
    } finally {
      setDeletingId(null);
    }
  };

  const createUser = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch(`${apiUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createForm.email.trim(),
          password: createForm.password,
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          role: createForm.role,
          projectIds: createForm.projectIds.split(",").map(s => s.trim()).filter(Boolean)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setShowCreate(false);
      setCreateForm(blankForm());
      await loadUsers();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-6 overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mt-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowCreate(v => !v); setCreateError(null); setCreateForm(blankForm()); }}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 transition-colors"
              >
                + Add User
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">New User</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Email *"
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className={inputCls}
                />
                <input
                  placeholder="Password *"
                  type="password"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className={inputCls}
                />
                <input
                  placeholder="First name"
                  value={createForm.firstName}
                  onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                  className={inputCls}
                />
                <input
                  placeholder="Last name"
                  value={createForm.lastName}
                  onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                  className={inputCls}
                />
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className={inputCls}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Projects</span>
                  {allProjects.map(p => {
                    const checked = createForm.projectIds.split(',').map(s => s.trim()).filter(Boolean).includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const current = createForm.projectIds.split(',').map(s => s.trim()).filter(Boolean);
                            const next = e.target.checked ? [...current, p.id] : current.filter(x => x !== p.id);
                            setCreateForm(f => ({ ...f, projectIds: next.join(',') }));
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        {p.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              {createError && <p className="text-xs text-red-500 mt-2">{createError}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={createUser}
                  disabled={creating || !createForm.email || !createForm.password}
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 transition-colors"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users list */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <div className="p-6 text-center text-gray-400 text-sm animate-pulse">Loading users…</div>
            )}
            {!loading && error && (
              <div className="p-6 text-center text-red-500 text-sm">{error}</div>
            )}
            {!loading && !error && users.map(u => (
              <div key={u.id} className="px-6 py-4">
                {editingId === u.id ? (
                  // Edit row
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <input
                        placeholder="First name"
                        value={editForm.firstName ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                        className={inputCls}
                      />
                      <input
                        placeholder="Last name"
                        value={editForm.lastName ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                        className={inputCls}
                      />
                      <select
                        value={editForm.role ?? u.role}
                        onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                        className={inputCls}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Projects</span>
                        {allProjects.map(p => {
                          const current = (editForm.projectIdsStr ?? "").split(',').map(s => s.trim()).filter(Boolean);
                          const checked = current.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const next = e.target.checked ? [...current, p.id] : current.filter(x => x !== p.id);
                                  setEditForm(f => ({ ...f, projectIdsStr: next.join(', ') }));
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                              />
                              {p.name}
                            </label>
                          );
                        })}
                      </div>
                      <input
                        placeholder="New password (leave blank to keep)"
                        type="password"
                        value={editForm.password ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                        className={`${inputCls} col-span-2`}
                      />
                    </div>
                    {saveError && <p className="text-xs text-red-500 mb-2">{saveError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(u.id)}
                        disabled={saving}
                        className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View row
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || <span className="text-gray-400 italic">No name</span>}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          u.role === "superadmin"
                            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{u.email}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {allProjects.map(p => {
                          const checked = u.projectIds.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={async (e) => {
                                  const next = e.target.checked
                                    ? [...u.projectIds, p.id]
                                    : u.projectIds.filter(x => x !== p.id);
                                  // Optimistic update
                                  setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, projectIds: next } : usr));
                                  // Save immediately
                                  await authFetch(`${apiUrl}/api/admin/users/${u.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ projectIds: next })
                                  });
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                              {p.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(u)}
                        className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deletingId === u.id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                      >
                        {deletingId === u.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const inputCls = "w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";
