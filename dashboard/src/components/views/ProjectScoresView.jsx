import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Search,
  X,
} from "lucide-react";
import TerminalLogs from "../ui/TerminalLogs";
import { TableSkeleton, CardSkeleton } from "../ui/SkeletonLoader";
import EmptyState from "../ui/EmptyState";
import Pagination from "../ui/Pagination";
import TopProgressBar from "../ui/TopProgressBar";
import { usePaginationState } from "../../hooks/usePaginationState";
import { getRatingColor, getScoreColor, getScoreDotClass, getScoreGradient } from "../../utils/scoreHelpers";
import { RankBadge } from "../ui/RankBadge";


// ─── Helpers ──────────────────────────────────────────────────────────────────


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
  CANCELLED: "cancelled",
};

// ─── Scan All — sequential queue hook ────────────────────────────────────────

function useScanAllQueue(projects, onFinishAll) {
  const [scanStates, setScanStates] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [cancelRequested, setCancelRequested] = useState(false);
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
              if (pData.status === "CANCELLED") st = SCAN_STATUS.CANCELLED;
              newStates[pid] = {
                status: st,
                message:
                  pData.message ||
                  (st === SCAN_STATUS.DONE
                    ? "Done"
                    : st === SCAN_STATUS.CANCELLED
                      ? "Cancelled"
                    : st === SCAN_STATUS.RUNNING
                      ? "Analyzing..."
                      : ""),
              };
            });
            setScanStates((prev) => ({ ...prev, ...newStates }));
          }
          setCancelRequested(Boolean(data.cancel_requested));

          if (
            data.status === "COMPLETED" ||
            data.status === "FAILED" ||
            data.status === "CANCELLED"
          ) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setIsScanning(false);
            setCancelRequested(false);
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
      } catch { }
    };
    checkActiveBatch();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [startPolling]);

  const startScanSelected = useCallback(async (selectedIds) => {
    if (isScanning || !selectedIds || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const init = {};
    ids.forEach((id) => {
      init[id] = { status: SCAN_STATUS.IDLE, message: "" };
    });
    setScanStates(init);
    setCancelRequested(false);
    try {
      const res = await fetch("/api/audit/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_ids: ids }),
      });
      const data = await res.json();
      if (data.job_id) startPolling(data.job_id);
    } catch (e) {
      console.error("Lỗi khi khởi chạy batch:", e);
    }
  }, [isScanning, startPolling]);

  const stopScan = useCallback(async () => {
    if (!activeJobId) return;
    try {
      const response = await fetch(`/api/audit/jobs/${activeJobId}/cancel`, {
        method: "POST",
      });
      if (response.ok) {
        setCancelRequested(true);
      }
    } catch {
      /* ignore transient errors */
    }
  }, [activeJobId]);

  return {
    scanStates,
    isScanning,
    activeJobId,
    cancelRequested,
    startScanSelected,
    stopScan,
  };
}

// ─── Scan Selection Modal ─────────────────────────────────────────────────────

function ScanSelectionModal({ projects, onClose, onConfirm }) {
  const [selected, setSelected] = useState(() => new Set(projects.map((p) => p.id)));
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return projects;
    const sl = search.toLowerCase();
    return projects.filter(
      (p) => p.name?.toLowerCase().includes(sl) || p.id?.toLowerCase().includes(sl),
    );
  }, [projects, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleAll = () => {
    const newSet = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach((p) => newSet.delete(p.id));
    } else {
      filtered.forEach((p) => newSet.add(p.id));
    }
    setSelected(newSet);
  };

  const toggle = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 flex flex-col max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-800" style={{ fontFamily: "Outfit" }}>
              Select Projects to Scan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Chọn các dự án cần phân tích chất lượng</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search + Select All */}
        <div className="p-4 border-b border-slate-100 shrink-0 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-violet-400 outline-none placeholder-slate-400 transition-colors"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
            <span className="text-sm font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
              {allFilteredSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              <span className="text-slate-400 font-normal ml-1">({filtered.length})</span>
            </span>
          </label>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map((project) => (
            <label
              key={project.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group"
            >
              <input
                type="checkbox"
                checked={selected.has(project.id)}
                onChange={() => toggle(project.id)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{project.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{project.id}</p>
              </div>
              {project.latest_score != null ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-black ${getScoreColor(project.latest_score)}`}>
                    {project.latest_score.toFixed(1)}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRatingColor(project.rating)}`}
                  >
                    {project.rating || "—"}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 italic">Chưa scan</span>
              )}
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            Hủy
          </button>
          <button
            onClick={() => { onConfirm(selected); onClose(); }}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Zap size={15} />
            Run Scan ({selected.size})
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Scan Status Pill ─────────────────────────────────────────────────────────

function ScanPill({ state }) {
  if (!state || state.status === SCAN_STATUS.IDLE) return null;
  const cfg = {
    [SCAN_STATUS.RUNNING]: {
      icon: <Loader2 size={10} className="animate-spin" />,
      text: "Scanning",
      cls: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    [SCAN_STATUS.DONE]: {
      icon: <CheckCircle2 size={10} />,
      text: "Done",
      cls: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    [SCAN_STATUS.ERROR]: {
      icon: <XCircle size={10} />,
      text: "Error",
      cls: "bg-rose-50 text-rose-600 border-rose-200",
    },
    [SCAN_STATUS.CANCELLED]: {
      icon: <AlertCircle size={10} />,
      text: "Cancelled",
      cls: "bg-amber-50 text-amber-600 border-amber-200",
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
    <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className={`h-full rounded-full ${gradientClass} shadow-sm ${glowClass}`}
      />
    </div>
  );
}

// ─── Pillar Mini Bars ─────────────────────────────────────────────────────────

const PILLAR_CONFIG = [
  { key: "Performance", label: "P", gradient: "from-cyan-400 to-teal-400", glow: "shadow-cyan-500/30", textColor: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  { key: "Maintainability", label: "M", gradient: "from-violet-400 to-purple-400", glow: "shadow-violet-500/30", textColor: "text-violet-400", bgColor: "bg-violet-500/10" },
  { key: "Reliability", label: "R", gradient: "from-blue-400 to-indigo-400", glow: "shadow-blue-500/30", textColor: "text-blue-400", bgColor: "bg-blue-500/10" },
  { key: "Security", label: "S", gradient: "from-rose-400 to-pink-400", glow: "shadow-rose-500/30", textColor: "text-rose-400", bgColor: "bg-rose-500/10" },
];

function PillarBars({ pillarScores }) {
  if (!pillarScores || typeof pillarScores !== "object") {
    return <span className="text-slate-600 text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[130px]">
      {PILLAR_CONFIG.map((p, i) => {
        const score = pillarScores[p.key];
        if (score === undefined || score === null) return null;
        const pct = Math.min(Math.max((score / 10) * 100, 0), 100);
        return (
          <div key={p.key} className="flex items-center gap-1.5">
            <span
              className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center shrink-0 ${p.bgColor} ${p.textColor}`}
            >
              {p.label}
            </span>
            <span className={`text-[11px] font-bold w-7 text-right ${p.textColor}`}>
              {parseFloat(score).toFixed(1)}
            </span>
            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden min-w-[50px]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                className={`h-full rounded-full bg-gradient-to-r ${p.gradient} shadow-sm ${p.glow}`}
              />
            </div>
          </div>
        );
      })}
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
          className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${active ? "text-pink-600" : "text-slate-500 group-hover:text-slate-600"}`}
        >
          {label}
        </span>
        {active ? (
          sortDir === "desc" ? (
            <ChevronDown size={12} className="text-pink-600" />
          ) : (
            <ChevronUp size={12} className="text-pink-600" />
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
      className={`group border-b border-slate-200 cursor-pointer transition-all duration-200 ${isRunning
        ? "bg-indigo-500/5"
        : "hover:bg-slate-50 hover:border-l-2 hover:border-l-pink-500/50"
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
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${isRunning
              ? "bg-indigo-500/20 border-indigo-500/40 animate-pulse"
              : "bg-gradient-to-br from-pink-500/20 to-indigo-500/20 border-slate-200"
              }`}
          >
            <FolderOpen
              size={14}
              className={isRunning ? "text-indigo-400" : "text-pink-600"}
            />
          </div>
          <div className="min-w-0">
            <div
              className="font-bold text-slate-800 text-sm truncate max-w-[180px]"
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

      {/* Pillars */}
      <td className="px-4 py-3">
        <PillarBars pillarScores={project.pillar_scores} />
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
              className={`text-sm font-bold ${project.violations_count > 100 ? "text-rose-400" : project.violations_count > 20 ? "text-amber-400" : "text-slate-600"}`}
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
          <span className="text-xs text-slate-500 font-medium">
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

  const {
    scanStates,
    isScanning,
    activeJobId,
    cancelRequested,
    startScanSelected,
    stopScan,
  } = useScanAllQueue(projects, fetchScores);

  const [showScanModal, setShowScanModal] = useState(false);

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
  const { pageItems: pagedProjects, pageStartIndex: projPageStartIndex } =
    usePaginationState({
      items: sorted,
      currentPage: projPage,
      pageSize: projPageSize,
      onPageChange: setProjPage,
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
    <>
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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-200 shadow-sm">
                  <BarChart3 size={14} className="text-violet-600" /> Project Leaderboard
                </div>
                <span className="text-slate-600 text-xs font-medium hidden sm:block">
                  Code quality ranking for all repositories
                </span>
              </div>
              <h2
                className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-800 via-fuchsia-700 to-pink-600"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                PROJECT LEADERBOARD
              </h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchScores}
                disabled={isLoading || isScanning}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold transition-all disabled:opacity-40"
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
                  disabled={cancelRequested}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50"
                >
                  <XCircle size={15} />
                  {cancelRequested ? "Cancelling..." : "Stop"}
                </button>
              ) : (
                <button
                  onClick={() => setShowScanModal(true)}
                  disabled={isLoading || projects.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-600 text-sm font-bold hover:bg-pink-500/20 transition-all disabled:opacity-40 group"
                >
                  <Zap
                    size={15}
                    className="group-hover:scale-110 transition-transform"
                  />
                  Scan Projects
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
                  icon: <FolderOpen size={16} className="text-pink-600" />,
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
                  className={`kpi-accent-card flex items-center gap-3 px-5 py-5 rounded-2xl bg-white border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${s.accent} ${s.accentLine}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      {s.label}
                    </div>
                    <div className="text-lg font-black text-slate-800 truncate max-w-[140px]">
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
                <div className="flex items-center gap-3 text-sm text-indigo-600 font-medium mb-3">
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-600 text-sm font-bold hover:bg-pink-500/20 transition-all"
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
            className={`bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-md transition-all duration-300 ${isLoading ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className="overflow-x-auto">
              <table
                className="w-full premium-table zebra-table"
                style={{ "--table-accent": "rgba(236, 72, 153, 0.5)" }}
              >
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
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
                        Pillars
                      </span>
                    </th>
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
                  {pagedProjects.map((project, idx) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      rank={projPageStartIndex + idx + 1}
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

      {/* Scan Selection Modal */}
      <AnimatePresence>
        {showScanModal && (
          <ScanSelectionModal
            projects={projects}
            onClose={() => setShowScanModal(false)}
            onConfirm={(selectedIds) => startScanSelected(selectedIds)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ProjectScoresView;
