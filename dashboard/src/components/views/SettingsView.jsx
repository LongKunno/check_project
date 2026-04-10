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
} from "lucide-react";
import { motion } from "framer-motion";
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
              value="V4 Stable"
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
