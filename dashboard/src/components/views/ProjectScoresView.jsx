import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  FolderOpen,
  Code2,
  AlertTriangle,
  BarChart3,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Zap,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Trophy,
  Star,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import TerminalLogs from "../ui/TerminalLogs";
import { TableSkeleton, CardSkeleton } from "../ui/SkeletonLoader";
import EmptyState from "../ui/EmptyState";
import Pagination from "../ui/Pagination";
import TopProgressBar from "../ui/TopProgressBar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRatingColor = (rating) => {
  if (!rating) return "bg-slate-700/50 text-slate-400 border-slate-600";
  const r = rating.toLowerCase();
  if (r.includes("excellent") || r.includes("xuất sắc"))
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (r.includes("good") || r.includes("tốt"))
    return "bg-blue-500/10 text-blue-400 border-blue-500/30";
  if (r.includes("fair") || r.includes("khá"))
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  if (r.includes("average") || r.includes("trung"))
    return "bg-orange-500/10 text-orange-400 border-orange-500/30";
  return "bg-rose-500/10 text-rose-400 border-rose-500/30";
};

const getScoreColor = (score) => {
  if (score == null) return "text-slate-500";
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-blue-400";
  if (score >= 65) return "text-amber-400";
  if (score >= 45) return "text-orange-400";
  return "text-rose-400";
};

const getScoreDotClass = (score) => {
  if (score == null) return "";
  if (score >= 90) return "score-dot score-dot-emerald";
  if (score >= 80) return "score-dot score-dot-blue";
  if (score >= 65) return "score-dot score-dot-amber";
  if (score >= 45) return "score-dot score-dot-orange";
  return "score-dot score-dot-rose";
};

const getScoreGradient = (score) => {
  if (score == null) return "from-slate-600 to-slate-800";
  if (score >= 90) return "from-emerald-400 to-teal-500";
  if (score >= 80) return "from-blue-400 to-indigo-500";
  if (score >= 65) return "from-amber-400 to-orange-500";
  return "from-rose-400 to-red-600";
};

const formatDate = (ts) => {
  if (!ts) return "—";
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const SCAN_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  DONE: "done",
  ERROR: "error",
};

// ─── Scan All — sequential queue hook ────────────────────────────────────────

function useScanAllQueue(projects, onFinishAll) {
  const [scanStates, setScanStates] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const pollTimerRef = useRef(null);

  const startPolling = useCallback(
    (jobId) => {
      setActiveJobId(jobId);
      setIsScanning(true);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/audit/jobs/${jobId}`);
          if (!res.ok) throw new Error("Connection error");
          const data = await res.json();

          if (data.result?.projects) {
            const newStates = {};
            Object.keys(data.result.projects).forEach((pid) => {
              const pData = data.result.projects[pid];
              let st = SCAN_STATUS.IDLE;
              if (pData.status === "PENDING") st = SCAN_STATUS.IDLE;
              if (pData.status === "RUNNING") st = SCAN_STATUS.RUNNING;
              if (pData.status === "COMPLETED") st = SCAN_STATUS.DONE;
              if (pData.status === "FAILED") st = SCAN_STATUS.ERROR;
              newStates[pid] = {
                status: st,
                message:
                  pData.message ||
                  (st === SCAN_STATUS.DONE
                    ? "Done"
                    : st === SCAN_STATUS.RUNNING
                      ? "Analyzing..."
                      : ""),
              };
            });
            setScanStates((prev) => ({ ...prev, ...newStates }));
          }

          if (data.status === "COMPLETED" || data.status === "FAILED") {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setIsScanning(false);
            onFinishAll?.();
          }
        } catch {
          /* ignore transient errors */
        }
      }, 2000);
    },
    [onFinishAll],
  );

  useEffect(() => {
    const checkActiveBatch = async () => {
      try {
        const res = await fetch("/api/audit/batch/active");
        const data = await res.json();
        if (data.has_active && data.job_id) startPolling(data.job_id);
      } catch {}
    };
    checkActiveBatch();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [startPolling]);

  const startScanAll = useCallback(async () => {
    if (isScanning || projects.length === 0) return;
    const init = {};
    projects.forEach((p) => {
      init[p.id] = { status: SCAN_STATUS.IDLE, message: "" };
    });
    setScanStates(init);
    try {
      const res = await fetch("/api/audit/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_ids: projects.map((p) => p.id) }),
      });
      const data = await res.json();
      if (data.job_id) startPolling(data.job_id);
    } catch (e) {
      console.error("Lỗi khi khởi chạy batch:", e);
    }
  }, [projects, isScanning, startPolling]);

  const stopScan = useCallback(() => {
    fetch("/api/audit/cancel", { method: "POST" }).catch(() => {});
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsScanning(false);
    setActiveJobId(null);
  }, []);

  return { scanStates, isScanning, activeJobId, startScanAll, stopScan };
}

// ─── Medal ────────────────────────────────────────────────────────────────────

function RankBadge({ rank }) {
  if (rank === 1)
    return (
      <div className="rank-badge rank-badge-gold">
        <Star size={12} />
      </div>
    );
  if (rank === 2)
    return (
      <div className="rank-badge rank-badge-silver">
        <Star size={12} />
      </div>
    );
  if (rank === 3)
    return (
      <div className="rank-badge rank-badge-bronze">
        <Star size={12} />
      </div>
    );
  return <div className="rank-badge rank-badge-default">{rank}</div>;
}

// ─── Scan Status Pill ─────────────────────────────────────────────────────────

function ScanPill({ state }) {
  if (!state || state.status === SCAN_STATUS.IDLE) return null;
  const cfg = {
    [SCAN_STATUS.RUNNING]: {
      icon: <Loader2 size={10} className="animate-spin" />,
      text: "Scanning",
      cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    },
    [SCAN_STATUS.DONE]: {
      icon: <CheckCircle2 size={10} />,
      text: "Done",
      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    [SCAN_STATUS.ERROR]: {
      icon: <XCircle size={10} />,
      text: "Error",
      cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    },
  }[state.status];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.text}
    </span>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const pct = Math.min(Math.max(((score ?? 0) / 100) * 100, 0), 100);
  const gradientClass =
    score >= 90
      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
      : score >= 80
        ? "bg-gradient-to-r from-blue-500 to-cyan-400"
        : score >= 65
          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
          : score >= 45
            ? "bg-gradient-to-r from-orange-500 to-amber-400"
            : "bg-gradient-to-r from-rose-500 to-pink-400";
  const glowClass =
    score >= 90
      ? "shadow-emerald-500/40"
      : score >= 80
        ? "shadow-blue-500/40"
        : score >= 65
          ? "shadow-amber-500/40"
          : "shadow-rose-500/40";
  return (
    <div className="w-24 bg-slate-800/80 rounded-full h-2 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className={`h-full rounded-full ${gradientClass} shadow-sm ${glowClass}`}
      />
    </div>
  );
}

// ─── Sort Th ──────────────────────────────────────────────────────────────────

function SortTh({ label, field, sortBy, sortDir, onClick, align = "left" }) {
  const active = sortBy === field;
  return (
    <th
      className={`px-4 py-3 text-${align} cursor-pointer select-none group`}
      onClick={() => onClick(field)}
    >
      <div
        className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}
      >
        <span
          className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${active ? "text-pink-400" : "text-slate-500 group-hover:text-slate-300"}`}
        >
          {label}
        </span>
        {active ? (
          sortDir === "desc" ? (
            <ChevronDown size={12} className="text-pink-400" />
          ) : (
            <ChevronUp size={12} className="text-pink-400" />
          )
        ) : (
          <ChevronDown
            size={12}
            className="text-slate-700 group-hover:text-slate-500 transition-colors"
          />
        )}
      </div>
    </th>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function ProjectRow({ project, rank, scanState, onSelect }) {
  const isRunning = scanState?.status === SCAN_STATUS.RUNNING;
  const hasScore =
    project.latest_score !== null && project.latest_score !== undefined;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={`group border-b border-white/[0.06] cursor-pointer transition-all duration-200 ${
        isRunning
          ? "bg-indigo-500/5"
          : "hover:bg-white/[0.05] hover:border-l-2 hover:border-l-pink-500/50"
      }`}
      onClick={() => onSelect?.(project.id)}
    >
      {/* Rank */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-center">
          <RankBadge rank={rank} />
        </div>
      </td>

      {/* Project */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              isRunning
                ? "bg-indigo-500/20 border-indigo-500/40 animate-pulse"
                : "bg-gradient-to-br from-pink-500/20 to-indigo-500/20 border-white/10"
            }`}
          >
            <FolderOpen
              size={14}
              className={isRunning ? "text-indigo-400" : "text-pink-400"}
            />
          </div>
          <div className="min-w-0">
            <div
              className="font-bold text-white text-sm truncate max-w-[180px]"
              title={project.name}
            >
              {project.name}
            </div>
            <div
              className="text-[11px] text-slate-500 truncate max-w-[180px]"
              title={project.url}
            >
              {project.url?.replace("https://", "")}
            </div>
          </div>
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-4">
        {hasScore ? (
          <div className="flex items-center gap-2.5">
            <span className={getScoreDotClass(project.latest_score)} />
            <span
              className={`text-xl font-black ${getScoreColor(project.latest_score)}`}
            >
              {parseFloat(project.latest_score).toFixed(1)}
            </span>
            <ScoreBar score={project.latest_score} />
          </div>
        ) : (
          <span className="text-slate-600 text-sm font-medium">
            Not scanned
          </span>
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {project.latest_rating ? (
            <span
              className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(project.latest_rating)}`}
            >
              {project.latest_rating}
            </span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
          <ScanPill state={scanState} />
        </div>
      </td>

      {/* Violations */}
      <td className="px-4 py-4 text-right">
        {hasScore ? (
          <div className="flex items-center justify-end gap-1.5">
            <AlertTriangle
              size={13}
              className={
                project.violations_count > 0
                  ? "text-amber-500"
                  : "text-slate-600"
              }
            />
            <span
              className={`text-sm font-bold ${project.violations_count > 100 ? "text-rose-400" : project.violations_count > 20 ? "text-amber-400" : "text-slate-300"}`}
            >
              {project.violations_count ?? "—"}
            </span>
          </div>
        ) : (
          <span className="text-slate-600 text-sm">—</span>
        )}
      </td>

      {/* Last scan */}
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Clock size={12} className="text-slate-600" />
          <span className="text-xs text-slate-400 font-medium">
            {formatDate(project.latest_timestamp)}
          </span>
        </div>
      </td>

      {/* Arrow */}
      <td className="px-4 py-4">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-pink-500">
          <ArrowRight size={16} />
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Module Cache ───
let cachedProjects = [];

const ProjectScoresView = ({ cn, onSelectProject }) => {
  const [projects, setProjects] = useState(cachedProjects);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("latest_score");
  const [sortDir, setSortDir] = useState("desc");
  const [projPage, setProjPage] = useState(1);
  const [projPageSize, setProjPageSize] = useState(10);

  const fetchScores = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repositories/scores");
      if (!res.ok) throw new Error("Unable to load score data");
      const data = await res.json();
      if (data.status === "success") {
        cachedProjects = data.data;
        setProjects(data.data);
      } else {
        setError(data.message || "Error parsing response");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const { scanStates, isScanning, activeJobId, startScanAll, stopScan } =
    useScanAllQueue(projects, fetchScores);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  // Sort: unscanned projects always at bottom
  const sorted = [...projects].sort((a, b) => {
    const nullA = a[sortBy] === null || a[sortBy] === undefined;
    const nullB = b[sortBy] === null || b[sortBy] === undefined;
    if (nullA && nullB) return 0;
    if (nullA) return 1;
    if (nullB) return -1;
    const va = a[sortBy];
    const vb = b[sortBy];
    if (typeof va === "string")
      return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
    return sortDir === "desc" ? vb - va : va - vb;
  });

  // KPI
  const scanned = projects.filter((p) => p.latest_score !== null);
  const avgScore = scanned.length
    ? (
        scanned.reduce((s, p) => s + p.latest_score, 0) / scanned.length
      ).toFixed(1)
    : null;
  const totalViolations = scanned.reduce(
    (s, p) => s + (p.violations_count || 0),
    0,
  );
  const topProject =
    scanned.length > 0
      ? [...scanned].sort((a, b) => b.latest_score - a.latest_score)[0]
      : null;

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-7xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pink-500/8 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/8 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 page-header-compact"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold">
                <BarChart3 size={14} /> Project Leaderboard
              </div>
              <span className="text-slate-600 text-xs font-medium hidden sm:block">
                Code quality ranking for all repositories
              </span>
            </div>
            <h2
              className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              PROJECT LEADERBOARD
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchScores}
              disabled={isLoading || isScanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw
                size={15}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
            {isScanning ? (
              <button
                onClick={stopScan}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold hover:bg-rose-500/20 transition-all"
              >
                <XCircle size={15} /> Stop
              </button>
            ) : (
              <button
                onClick={startScanAll}
                disabled={isLoading || projects.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 text-sm font-bold hover:bg-pink-500/20 transition-all disabled:opacity-40 group"
              >
                <Zap
                  size={15}
                  className="group-hover:scale-110 transition-transform"
                />
                Scan All
              </button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        {!isLoading && projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              {
                label: "Total projects",
                value: projects.length,
                icon: <FolderOpen size={16} className="text-pink-400" />,
                accent:
                  "border-pink-500/25 shadow-[0_0_15px_-5px_rgba(236,72,153,0.15)]",
                accentLine: "kpi-accent-pink",
              },
              {
                label: "Avg score",
                value: avgScore ? `${avgScore}/100` : "—",
                icon: <Star size={16} className="text-amber-400" />,
                accent:
                  "border-amber-500/25 shadow-[0_0_15px_-5px_rgba(245,158,11,0.15)]",
                accentLine: "kpi-accent-amber",
              },
              {
                label: "Top project",
                value: topProject?.name?.split("_").join(" ") || "—",
                icon: <Trophy size={16} className="text-emerald-400" />,
                accent:
                  "border-emerald-500/25 shadow-[0_0_15px_-5px_rgba(16,185,129,0.15)]",
                accentLine: "kpi-accent-emerald",
              },
              {
                label: "Total violations",
                value: totalViolations.toLocaleString(),
                icon: <AlertTriangle size={16} className="text-orange-400" />,
                accent:
                  "border-orange-500/25 shadow-[0_0_15px_-5px_rgba(249,115,22,0.15)]",
                accentLine: "kpi-accent-orange",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`kpi-accent-card flex items-center gap-3 px-5 py-5 rounded-2xl bg-white/[0.03] border backdrop-blur-sm transition-all hover:bg-white/[0.06] ${s.accent} ${s.accentLine}`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    {s.label}
                  </div>
                  <div className="text-lg font-black text-white truncate max-w-[140px]">
                    {s.value}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Scan progress */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 overflow-hidden"
            >
              <div className="flex items-center gap-3 text-sm text-indigo-300 font-medium mb-3">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>
                  Batch scan in progress — state persists even after page
                  reload...
                </span>
              </div>
              {activeJobId && (
                <div className="opacity-90 hover:opacity-100 transition-opacity">
                  <TerminalLogs isAuditing={true} jobId={activeJobId} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── States ── */}
      <TopProgressBar isFetching={isLoading && projects.length > 0} />
      
      {isLoading && projects.length === 0 ? (
        <div className="w-full h-[50vh] flex flex-col items-center justify-center opacity-70">
          <TopProgressBar isFetching={true} />
        </div>
      ) : error && projects.length === 0 ? (
        <EmptyState
          variant="error"
          title="Data fetch error"
          description={error}
          accentColor="rose"
          action={
            <button
              onClick={fetchScores}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 text-sm font-bold hover:bg-pink-500/20 transition-all"
            >
              <RefreshCw size={14} /> Retry
            </button>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState
          variant="noData"
          title="No projects yet"
          description="Configure repositories in system settings to see them on the leaderboard."
          accentColor="pink"
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`bg-[#0f1629]/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${isLoading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <div className="overflow-x-auto">
            <table
              className="w-full premium-table"
              style={{ "--table-accent": "rgba(236, 72, 153, 0.5)" }}
            >
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                  <th className="px-4 py-3 text-center">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                      #
                    </span>
                  </th>
                  <SortTh
                    label="Project"
                    field="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                  />
                  <SortTh
                    label="Score"
                    field="latest_score"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                  />
                  <th className="px-4 py-3 text-left">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                      Rating
                    </span>
                  </th>
                  <SortTh
                    label="Violations"
                    field="violations_count"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                    align="right"
                  />
                  <SortTh
                    label="Last Audit"
                    field="latest_timestamp"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                    align="right"
                  />
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted
                  .slice((projPage - 1) * projPageSize, projPage * projPageSize)
                  .map((project, idx) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      rank={(projPage - 1) * projPageSize + idx + 1}
                      scanState={scanStates[project.id]}
                      onSelect={onSelectProject}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={projPage}
            totalItems={sorted.length}
            pageSize={projPageSize}
            onPageChange={setProjPage}
            onPageSizeChange={setProjPageSize}
            showPageSizeSelector={true}
            label="projects"
          />
        </motion.div>
      )}
    </div>
  );
};

export default ProjectScoresView;
