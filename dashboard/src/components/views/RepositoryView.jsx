/**
 * RepositoryView — Dedicated page for Repository Management.
 * Tách từ SettingsView + nâng cấp UI premium.
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Plus,
  Edit3,
  Trash2,
  X,
  GitBranch,
  Check,
  Zap,
  Search,
  Globe,
  ExternalLink,
  Shield,
  Database,
  Clock,
  Server,
} from "lucide-react";
import { useToast } from "../ui/Toast";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));
const buildRepositoryApiUrl = (repoId) => `/api/repositories/${encodeURI(repoId)}`;

async function readApiError(response) {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.message || "Server error";
  } catch {
    return "Server error";
  }
}

/* ─── Page Header ──────────────────────────────────────────────────────── */
const PageHeader = ({ repoCount, onAdd }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
        <Database size={24} className="text-teal-400" />
      </div>
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-1">
          <span className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <Server size={10} /> Repository Manager
          </span>
          <span className="text-slate-600">Manage Git repositories for code auditing</span>
        </div>
        <h1
          className="text-3xl sm:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 via-slate-600 to-slate-500 leading-tight tracking-tight"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          REPOSITORIES
        </h1>
      </div>
    </div>
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98]"
    >
      <Plus size={16} /> Add Repository
    </button>
  </div>
);

/* ─── KPI Row ──────────────────────────────────────────────────────────── */
const KpiRow = ({ repos }) => {
  const active = repos.filter(r => r.is_active !== false).length;
  const providers = useMemo(() => {
    const set = new Set();
    repos.forEach(r => {
      if (r.url?.includes("github")) set.add("GitHub");
      else if (r.url?.includes("bitbucket")) set.add("Bitbucket");
      else if (r.url?.includes("gitlab")) set.add("GitLab");
      else set.add("Other");
    });
    return set.size;
  }, [repos]);

  const kpis = [
    { label: "Total Repos", value: repos.length, accent: "#14b8a6", icon: Database },
    { label: "Active", value: active, accent: "#22c55e", icon: Shield },
    { label: "Providers", value: providers, accent: "#8b5cf6", icon: Globe },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex items-center gap-3 group cursor-default"
          style={{
            background: "#ffffff",
            borderColor: `${kpi.accent}30`,
            boxShadow: `0 0 20px -6px ${kpi.accent}20`,
          }}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-15 blur-2xl pointer-events-none" style={{ background: kpi.accent }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: `${kpi.accent}15`, borderColor: `${kpi.accent}35` }}>
            <kpi.icon size={18} style={{ color: kpi.accent }} />
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-slate-800 leading-none">{kpi.value}</span>
            <span className="block text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: kpi.accent }}>{kpi.label}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

/* ─── Repo Card ────────────────────────────────────────────────────────── */
const RepoCard = ({ repo, index, onEdit, onDelete }) => {
  const providerInfo = useMemo(() => {
    if (repo.url?.includes("github")) return { name: "GitHub", color: "text-slate-600", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (repo.url?.includes("bitbucket")) return { name: "Bitbucket", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" };
    if (repo.url?.includes("gitlab")) return { name: "GitLab", color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20" };
    return { name: "Git", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
  }, [repo.url]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.25 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-teal-500/30 hover:-translate-y-1 transition-all duration-300"
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-teal-500/40 via-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="p-5 flex flex-col gap-3.5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
              <FolderOpen size={18} className="text-teal-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black text-slate-800 truncate">{repo.name}</h3>
              <span className="text-[10px] font-mono text-slate-600">{repo.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(repo)}
              className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition-all"
              title="Chỉnh sửa"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => onDelete(repo.id, repo.name)}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Xóa"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* URL */}
        <div className="flex items-center gap-2">
          <Globe size={12} className="text-slate-600 shrink-0" />
          <a
            href={repo.url?.replace(/\.git$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 font-mono truncate hover:text-teal-400 transition-colors flex items-center gap-1"
          >
            {repo.url} <ExternalLink size={10} className="shrink-0 opacity-50" />
          </a>
        </div>

        {/* Footer badges */}
        <div className="flex items-center gap-2 pt-1">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border", providerInfo.bg, providerInfo.color, providerInfo.border)}>
            {providerInfo.name}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 text-[10px] font-bold">
            <GitBranch size={10} /> {repo.branch || "main"}
          </span>
          {repo.created_at && (
            <span className="text-[9px] text-slate-600 ml-auto flex items-center gap-1">
              <Clock size={9} /> {new Date(repo.created_at).toLocaleDateString("vi-VN")}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Add/Edit Form Modal ──────────────────────────────────────────────── */
const RepoFormModal = ({ show, editing, form, setForm, onSave, onClose, saving }) => {
  if (!show) return null;

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50 transition-all";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-100 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/25">
                {editing ? <Edit3 size={16} className="text-teal-400" /> : <Plus size={16} className="text-teal-400" />}
              </div>
              <h3 className="text-slate-800 font-bold text-sm">
                {editing ? "Chỉnh Sửa Repository" : "Thêm Repository Mới"}
              </h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">ID *</label>
                <input type="text" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!editing} placeholder="org/repo-name" className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Tên hiển thị *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Project" className={cn(inputCls, "font-sans")} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Git URL *</label>
              <input type="text" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://github.com/org/repo.git" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Username</label>
                <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Optional" className={cn(inputCls, "font-sans")} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">
                  Token {editing && <span className="text-slate-600 normal-case">(để trống giữ nguyên)</span>}
                </label>
                <input type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="•••••••••" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Branch</label>
              <input type="text" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="main" className={cn(inputCls, "w-40")} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 transition-all shadow-lg shadow-teal-500/15"
            >
              {saving ? <Zap className="animate-spin" size={14} /> : <Check size={14} />}
              {saving ? "Đang lưu..." : editing ? "Cập Nhật" : "Tạo Mới"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-100 transition-all">
              Hủy
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ─── Main Component ───────────────────────────────────────────────────── */
const RepositoryView = () => {
  const [repos, setRepos] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRepo, setEditingRepo] = useState(null);
  const [repoForm, setRepoForm] = useState({ id: "", name: "", url: "", username: "", token: "", branch: "main" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchRepos = async () => {
    try {
      const res = await fetch("/api/repositories");
      if (res.ok) {
        const d = await res.json();
        if (d.status === "success") setRepos(d.data);
      }
    } catch (e) { }
  };

  useEffect(() => { fetchRepos(); }, []);

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repos;
    const q = search.toLowerCase();
    return repos.filter(r => r.name?.toLowerCase().includes(q) || r.url?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q));
  }, [repos, search]);

  const openAddForm = () => {
    setEditingRepo(null);
    setRepoForm({ id: "", name: "", url: "", username: "", token: "", branch: "main" });
    setShowForm(true);
  };

  const openEditForm = (repo) => {
    setEditingRepo(repo.id);
    setRepoForm({ id: repo.id, name: repo.name, url: repo.url, username: repo.username || "", token: "", branch: repo.branch || "main" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!repoForm.id || !repoForm.name || !repoForm.url) {
      toast.error("ID, Name, và URL là bắt buộc.", "Validation Error");
      return;
    }
    setSaving(true);
    try {
      const method = editingRepo ? "PUT" : "POST";
      const url = editingRepo ? buildRepositoryApiUrl(editingRepo) : "/api/repositories";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(repoForm) });
      if (res.ok) {
        toast.success(`Repository "${repoForm.name}" ${editingRepo ? "đã cập nhật" : "đã tạo"} thành công.`, editingRepo ? "Updated" : "Created");
        setShowForm(false);
        fetchRepos();
      } else {
        toast.error(await readApiError(res), "Error");
      }
    } catch (e) {
      toast.error("Lỗi kết nối mạng", "Connection Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (repoId, repoName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa repository "${repoName}"?\n(Dữ liệu audit history vẫn giữ nguyên)`)) return;
    try {
      const res = await fetch(buildRepositoryApiUrl(repoId), { method: "DELETE" });
      if (res.ok) {
        setRepos((current) => current.filter((repo) => repo.id !== repoId));
        toast.success(`Repository "${repoName}" đã xóa.`, "Deleted");
        fetchRepos();
      } else {
        toast.error(await readApiError(res), "Error");
      }
    } catch (e) {
      toast.error("Xóa thất bại.", "Error");
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-transparent pt-0 pb-12 gap-5 font-sans relative max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader repoCount={repos.length} onAdd={openAddForm} />

      {/* KPI Row */}
      <KpiRow repos={repos} />

      {/* Search + Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search size={16} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm repos theo tên, URL, hoặc ID..."
            className="flex-1 bg-transparent text-slate-800 text-sm placeholder:text-slate-600 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-slate-500 hover:text-slate-800 transition-colors">
              <X size={14} />
            </button>
          )}
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            {filteredRepos.length} / {repos.length}
          </span>
        </div>

        {/* Cards Grid */}
        <div className="p-5">
          {filteredRepos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRepos.map((repo, i) => (
                <RepoCard key={repo.id} repo={repo} index={i} onEdit={openEditForm} onDelete={handleDelete} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Database size={28} className="text-slate-600" />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                {search ? "Không tìm thấy repository phù hợp" : "Chưa có repository nào. Nhấn \"Add Repository\" để bắt đầu."}
              </p>
              {search && (
                <button onClick={() => setSearch("")} className="text-xs text-teal-400 hover:text-teal-300 font-bold transition-colors">
                  Xóa bộ lọc
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <RepoFormModal
        show={showForm}
        editing={editingRepo}
        form={repoForm}
        setForm={setRepoForm}
        onSave={handleSave}
        onClose={() => setShowForm(false)}
        saving={saving}
      />
    </div>
  );
};

export default RepositoryView;
