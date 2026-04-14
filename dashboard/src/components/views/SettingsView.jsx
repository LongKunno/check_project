import React, { useState, useEffect } from "react";
import {
  Settings,
  AlertTriangle,
  Zap,
  Trash2,
  ShieldAlert,
  Activity,
  ShieldCheck,
  Code2,
  ExternalLink,
  Server,
  Clock,
  Cpu,
  Info,
  FolderOpen,
  Plus,
  Edit3,
  X,
  GitBranch,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../ui/Toast";

const InfoCard = ({
  icon,
  label,
  value,
  iconClass = "bg-slate-500/10 border-slate-500/20 text-slate-400",
  accent = "",
}) => (
  <div
    className={`flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border backdrop-blur-sm transition-all hover:bg-white/[0.06] ${accent || "border-white/8"}`}
  >
    <div className={`p-2 rounded-xl border ${iconClass}`}>{icon}</div>
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        {label}
      </div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  </div>
);

const SectionTitle = ({ icon, title, description }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400">
      {icon}
    </div>
    <div>
      <h3 className="text-white font-extrabold text-sm tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-slate-500 text-xs mt-0.5">{description}</p>
      )}
    </div>
  </div>
);

const SettingsView = ({ selectedRepoId, cn }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [rulesInfo, setRulesInfo] = useState(null);
  const toast = useToast();

  // ── Repository Management State ─────────────────────────────────────────
  const [repos, setRepos] = useState([]);
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [editingRepo, setEditingRepo] = useState(null);
  const [repoForm, setRepoForm] = useState({
    id: "",
    name: "",
    url: "",
    username: "",
    token: "",
    branch: "main",
  });
  const [repoSaving, setRepoSaving] = useState(false);

  // Fetch repositories
  const fetchRepos = async () => {
    try {
      const res = await fetch("/api/repositories");
      if (res.ok) {
        const d = await res.json();
        if (d.status === "success") setRepos(d.data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const openAddForm = () => {
    setEditingRepo(null);
    setRepoForm({ id: "", name: "", url: "", username: "", token: "", branch: "main" });
    setShowRepoForm(true);
  };

  const openEditForm = (repo) => {
    setEditingRepo(repo.id);
    setRepoForm({
      id: repo.id,
      name: repo.name,
      url: repo.url,
      username: repo.username || "",
      token: "",  // token không trả về từ API (ẩn)
      branch: repo.branch || "main",
    });
    setShowRepoForm(true);
  };

  const handleRepoSave = async () => {
    if (!repoForm.id || !repoForm.name || !repoForm.url) {
      toast.error("ID, Name, và URL là bắt buộc.", "Validation Error");
      return;
    }
    setRepoSaving(true);
    try {
      const method = editingRepo ? "PUT" : "POST";
      const url = editingRepo ? `/api/repositories/${editingRepo}` : "/api/repositories";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repoForm),
      });
      if (res.ok) {
        toast.success(
          `Repository "${repoForm.name}" ${editingRepo ? "updated" : "created"} successfully.`,
          editingRepo ? "Updated" : "Created",
        );
        setShowRepoForm(false);
        fetchRepos();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Server error", "Error");
      }
    } catch (e) {
      toast.error("Network error", "Connection Error");
    } finally {
      setRepoSaving(false);
    }
  };

  const handleRepoDelete = async (repoId, repoName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa repository "${repoName}"?\n(Dữ liệu audit history vẫn giữ nguyên)`)) return;
    try {
      const res = await fetch(`/api/repositories/${repoId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Repository "${repoName}" removed.`, "Deleted");
        fetchRepos();
      }
    } catch (e) {
      toast.error("Delete failed.", "Error");
    }
  };

  // Fetch system info
  useEffect(() => {
    fetch("/api/health/ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSystemInfo(d);
      })
      .catch(() => {});
  }, []);

  // Fetch rules summary
  useEffect(() => {
    if (!selectedRepoId) return;
    fetch(`/api/rules?target=${encodeURIComponent(selectedRepoId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((resp) => {
        if (!resp?.data) return;
        const d = resp.data;
        const coreCount = d.default_rules
          ? Object.keys(d.default_rules).length
          : 0;
        const customRegex = d.compiled_json?.regex_rules?.length || 0;
        const customAst =
          d.compiled_json?.ast_rules?.dangerous_functions?.length || 0;
        const disabledCount = d.disabled_rules?.length || 0;
        setRulesInfo({
          coreCount,
          customCount: customRegex + customAst,
          disabledCount,
        });
      })
      .catch(() => {});
  }, [selectedRepoId]);

  const handleReset = async () => {
    if (!selectedRepoId) return;
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    setIsResetting(true);
    try {
      const res = await fetch(
        `/api/rules?target=${encodeURIComponent(selectedRepoId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        toast.success(
          "All custom rules have been deleted and weights reset to default.",
          "Rules Reset",
        );
      } else {
        toast.error("Server error while resetting rules.", "Reset Failed");
      }
    } catch (e) {
      toast.error("Network connection error.", "Connection Error");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-4xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-500/6 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-slate-500/6 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 page-header-compact"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-semibold">
              <Settings size={14} /> System Settings
            </div>
            <span className="text-slate-600 text-xs font-medium hidden sm:block">
              Manage configuration and parameters for the audit engine
            </span>
          </div>
          <h2
            className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-300 to-slate-500"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            SYSTEM SETTINGS
          </h2>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* ── System Information ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0f1629]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
        >
          <SectionTitle
            icon={<Server size={18} />}
            title="System Information"
            description="Current engine status and environment"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard
              icon={<Cpu size={16} />}
              label="Engine"
              value={`V${import.meta.env.VITE_APP_VERSION || "1.0.0"} Stable`}
              iconClass="bg-blue-500/10 border-blue-500/20 text-blue-400"
              accent="border-blue-500/25 shadow-[0_0_15px_-5px_rgba(59,130,246,0.15)]"
            />
            <InfoCard
              icon={<Code2 size={16} />}
              label="Framework"
              value="React + FastAPI"
              iconClass="bg-violet-500/10 border-violet-500/20 text-violet-400"
              accent="border-violet-500/25 shadow-[0_0_15px_-5px_rgba(139,92,246,0.15)]"
            />
            <InfoCard
              icon={<Clock size={16} />}
              label="AI Model"
              value={systemInfo?.model || "GPT-4o-mini"}
              iconClass="bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
              accent="border-cyan-500/25 shadow-[0_0_15px_-5px_rgba(6,182,212,0.15)]"
            />
          </div>
        </motion.div>

        {/* ── Engine Configuration ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#0f1629]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
        >
          <SectionTitle
            icon={<ShieldCheck size={18} />}
            title="Engine Configuration"
            description={`Rules configured for: ${selectedRepoId || "none"}`}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard
              icon={<ShieldCheck size={16} />}
              label="Core Rules"
              value={rulesInfo ? `${rulesInfo.coreCount} rules` : "—"}
              iconClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              accent="border-emerald-500/25 shadow-[0_0_15px_-5px_rgba(16,185,129,0.15)]"
            />
            <InfoCard
              icon={<Zap size={16} />}
              label="Custom AI Rules"
              value={rulesInfo ? `${rulesInfo.customCount} rules` : "—"}
              iconClass="bg-violet-500/10 border-violet-500/20 text-violet-400"
              accent="border-violet-500/25 shadow-[0_0_15px_-5px_rgba(139,92,246,0.15)]"
            />
            <InfoCard
              icon={<AlertTriangle size={16} />}
              label="Disabled Rules"
              value={rulesInfo ? `${rulesInfo.disabledCount} rules` : "—"}
              iconClass="bg-amber-500/10 border-amber-500/20 text-amber-400"
              accent="border-amber-500/25 shadow-[0_0_15px_-5px_rgba(245,158,11,0.15)]"
            />
          </div>
        </motion.div>

        {/* ── Repository Management ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-[#0f1629]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-5">
            <SectionTitle
              icon={<FolderOpen size={18} />}
              title="Repository Management"
              description={`${repos.length} repositories configured`}
            />
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all"
            >
              <Plus size={14} /> Add Repository
            </button>
          </div>

          {/* Form thêm/sửa */}
          <AnimatePresence>
            {showRepoForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-5"
              >
                <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-bold">
                      {editingRepo ? "Edit Repository" : "Add New Repository"}
                    </h4>
                    <button
                      onClick={() => setShowRepoForm(false)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">ID *</label>
                      <input
                        type="text"
                        value={repoForm.id}
                        onChange={(e) => setRepoForm({ ...repoForm, id: e.target.value })}
                        disabled={!!editingRepo}
                        placeholder="org/repo-name"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Name *</label>
                      <input
                        type="text"
                        value={repoForm.name}
                        onChange={(e) => setRepoForm({ ...repoForm, name: e.target.value })}
                        placeholder="My Project"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Git URL *</label>
                      <input
                        type="text"
                        value={repoForm.url}
                        onChange={(e) => setRepoForm({ ...repoForm, url: e.target.value })}
                        placeholder="https://github.com/org/repo.git"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Username</label>
                      <input
                        type="text"
                        value={repoForm.username}
                        onChange={(e) => setRepoForm({ ...repoForm, username: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">
                        Token {editingRepo && <span className="text-slate-600 normal-case">(leave empty to keep current)</span>}
                      </label>
                      <input
                        type="password"
                        value={repoForm.token}
                        onChange={(e) => setRepoForm({ ...repoForm, token: e.target.value })}
                        placeholder="•••••••••"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Branch</label>
                      <input
                        type="text"
                        value={repoForm.branch}
                        onChange={(e) => setRepoForm({ ...repoForm, branch: e.target.value })}
                        placeholder="main"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleRepoSave}
                      disabled={repoSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/25 hover:border-blue-500/50 disabled:opacity-50 transition-all"
                    >
                      {repoSaving ? <Zap className="animate-spin" size={14} /> : <Check size={14} />}
                      {repoSaving ? "Saving..." : editingRepo ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => setShowRepoForm(false)}
                      className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bảng danh sách repositories */}
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.03]">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Name</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold hidden md:table-cell">URL</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Branch</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => (
                  <tr
                    key={repo.id}
                    className="border-t border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-white">{repo.name}</div>
                      <div className="text-[10px] text-slate-600 font-mono">{repo.id}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-slate-400 font-mono truncate max-w-[280px]">{repo.url}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                        <GitBranch size={10} /> {repo.branch || "main"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => openEditForm(repo)}
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleRepoDelete(repo.id, repo.name)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {repos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-600 text-sm">
                      No repositories configured. Click "Add Repository" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Quick Links ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0f1629]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
        >
          <SectionTitle
            icon={<Info size={18} />}
            title="Quick Links"
            description="Useful resources and endpoints"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                label: "Documentation",
                href: "http://localhost:8001",
                desc: "MkDocs project docs",
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all group"
              >
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                    {link.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {link.desc}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-slate-600 group-hover:text-blue-400 transition-colors shrink-0"
                />
              </a>
            ))}
          </div>
        </motion.div>

        {/* ── Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#0f1629]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
        >
          <div className="border border-red-500/20 rounded-2xl p-6 bg-red-900/10">
            <h3 className="text-red-400 font-extrabold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldAlert size={16} /> Danger Zone
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Reset all audit rules for project{" "}
              <strong className="text-white px-2 py-0.5 bg-black/35 rounded font-mono">
                {selectedRepoId || "none selected"}
              </strong>{" "}
              to their original default state. All AI-generated custom rules and
              weight overrides will be permanently deleted,{" "}
              <span className="text-red-400 font-semibold">
                this cannot be undone
              </span>
              .
            </p>
            <button
              onClick={handleReset}
              disabled={!selectedRepoId || isResetting}
              className={cn(
                "px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                !selectedRepoId || isResetting
                  ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500"
                  : confirmReset
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_24px_rgba(220,38,38,0.4)] animate-pulse"
                    : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50",
              )}
            >
              {isResetting ? (
                <Zap className="animate-spin" size={18} />
              ) : (
                <Trash2 size={18} />
              )}
              {isResetting
                ? "DELETING DATA..."
                : confirmReset
                  ? "⚠ CONFIRM RESET?"
                  : "RESET TO DEFAULTS"}
            </button>
            {confirmReset && (
              <p className="mt-3 text-xs text-red-400/70 font-medium">
                Click again to confirm. This action will cancel automatically in
                3 seconds.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsView;
