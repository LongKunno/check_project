import React, { useState, useEffect } from "react";
import {
  FileSearch,
  Zap,
  FolderOpen,
  RefreshCw,
  Clock,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  Calendar,
  Bot,
} from "lucide-react";
import { motion } from "framer-motion";
import { getScoreColorClass } from "../../utils/chartHelpers";
import { TableSkeleton, CardSkeleton } from "../ui/SkeletonLoader";
import EmptyState from "../ui/EmptyState";
import Pagination from "../ui/Pagination";
import { useToast } from "../ui/Toast";

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
  return "bg-rose-500/10 text-rose-400 border-rose-500/30";
};

const getRelativeTime = (isoStr) => {
  if (!isoStr) return "—";
  const date = new Date(isoStr + "Z");
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getScoreGradient = (score) => {
  if (score == null) return "from-slate-600 to-slate-800";
  if (score >= 90) return "from-emerald-400 to-teal-500";
  if (score >= 80) return "from-blue-400 to-indigo-500";
  if (score >= 65) return "from-amber-400 to-orange-500";
  return "from-rose-400 to-red-600";
};

// ─── Score Mini Bar ──────────────────────────────────────────────────────────

function ScoreMiniBar({ score, maxScore = 100 }) {
  const pct = Math.min((score / maxScore) * 100, 100);
  const colorClass =
    score >= 90
      ? "bg-emerald-500"
      : score >= 80
        ? "bg-blue-500"
        : score >= 65
          ? "bg-amber-500"
          : "bg-rose-500";
  return (
    <div className="flex items-center gap-2.5 min-w-[140px]">
      <span
        className={`text-xl font-black bg-clip-text text-transparent bg-gradient-to-r ${getScoreGradient(score)}`}
      >
        {score}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className={`h-full rounded-full ${colorClass}`}
        />
      </div>
    </div>
  );
}

// ─── Stats Summary ──────────────────────────────────────────────────────────

function HistoryStats({ historyList }) {
  if (!historyList.length) return null;
  const avgScore = (
    historyList.reduce((s, h) => s + h.score, 0) / historyList.length
  ).toFixed(1);
  const bestScore = Math.max(...historyList.map((h) => h.score));
  const latestDate = historyList[0]?.timestamp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
    >
      {[
        {
          label: "Total scans",
          value: historyList.length,
          icon: <FileSearch size={15} className="text-amber-400" />,
          accent:
            "border-amber-500/25 shadow-[0_0_15px_-5px_rgba(245,158,11,0.15)]",
        },
        {
          label: "Avg score",
          value: `${avgScore}/100`,
          icon: <TrendingUp size={15} className="text-cyan-400" />,
          accent:
            "border-cyan-500/25 shadow-[0_0_15px_-5px_rgba(6,182,212,0.15)]",
        },
        {
          label: "Best score",
          value: `${bestScore}/100`,
          icon: <Zap size={15} className="text-emerald-400" />,
          accent:
            "border-emerald-500/25 shadow-[0_0_15px_-5px_rgba(16,185,129,0.15)]",
        },
        {
          label: "Last audit",
          value: getRelativeTime(latestDate),
          icon: <Calendar size={15} className="text-violet-400" />,
          accent:
            "border-violet-500/25 shadow-[0_0_15px_-5px_rgba(139,92,246,0.15)]",
        },
      ].map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.03] border backdrop-blur-sm transition-all hover:bg-white/[0.06] ${s.accent}`}
        >
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            {s.icon}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              {s.label}
            </div>
            <div className="text-lg font-black text-white">{s.value}</div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const HistoryView = ({ selectedRepoId, targetUrl, onRestoreAudit, cn }) => {
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(10);
  const toast = useToast();

  const fetchTarget = targetUrl || selectedRepoId;

  const loadHistory = () => {
    if (!fetchTarget) return;
    setIsLoading(true);
    fetch(`/api/history?target=${encodeURIComponent(fetchTarget)}`)
      .then((r) => r.json())
      .then((data) => setHistoryList(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [targetUrl, selectedRepoId]);

  const handleRestore = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/history/${id}`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.full_json) {
          onRestoreAudit(detail.full_json);
          toast.success("Audit session restored successfully.", "Restored");
        } else {
          toast.warning(
            "History report does not contain detailed JSON data.",
            "No Data",
          );
        }
      } else {
        toast.error(
          "Error retrieving history details from the backend.",
          "Load Failed",
        );
      }
    } catch (e) {
      toast.error("Network connection error.", "Connection Error");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-6xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-amber-500/6 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-orange-500/6 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 page-header-compact"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <FileSearch size={14} /> Audit History
              </div>
              <span className="text-slate-600 text-xs font-medium hidden sm:block">
                Look up and restore previous code analysis sessions
              </span>
            </div>
            <h2
              className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              AUDIT HISTORY
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl font-mono text-sm text-slate-300 max-w-[220px] truncate"
              title={fetchTarget}
            >
              {fetchTarget || "No project selected"}
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoading || !fetchTarget}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw
                size={15}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Content ── */}
      {!fetchTarget ? (
        <EmptyState
          variant="noData"
          title="No project selected"
          description="Please choose a project from the sidebar to view its audit history."
          accentColor="amber"
        />
      ) : isLoading ? (
        <div className="space-y-6">
          <CardSkeleton count={4} />
          <TableSkeleton rows={4} cols={5} />
        </div>
      ) : historyList.length === 0 ? (
        <EmptyState
          variant="empty"
          title="No audit history yet"
          description="Run at least one audit on this project to see its history here."
          accentColor="amber"
        />
      ) : (
        <>
          {/* Stats Summary */}
          <HistoryStats historyList={historyList} />

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[#080c14]/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                    {[
                      "Scanned At",
                      "Rating",
                      "Score",
                      "Scale (LOC)",
                      "Violations",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[10px] uppercase tracking-widest font-bold text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyList
                    .slice(
                      (histPage - 1) * histPageSize,
                      histPage * histPageSize,
                    )
                    .map((h, idx) => {
                      const colorClass = getScoreColorClass(h.score / 10);
                      return (
                        <motion.tr
                          key={h.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="border-b border-white/[0.06] hover:bg-white/[0.05] hover:border-l-2 hover:border-l-amber-500/50 transition-all duration-200 group"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                                style={{
                                  backgroundColor: colorClass,
                                  color: colorClass,
                                }}
                              />
                              <div>
                                <div className="text-sm font-semibold text-slate-200">
                                  {getRelativeTime(h.timestamp)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {new Date(h.timestamp + "Z").toLocaleString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span
                                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(h.rating)}`}
                              >
                                {h.rating}
                              </span>
                              {h.scan_mode === "static_only" ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50"
                                  title="Static Analysis Only"
                                >
                                  <Zap size={10} className="text-slate-400" />{" "}
                                  STATIC
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20"
                                  title="AI Augmented Audit"
                                >
                                  <Bot size={10} className="text-indigo-400" />{" "}
                                  AI SCAN
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <ScoreMiniBar score={h.score} />
                          </td>
                          <td className="px-5 py-4 text-slate-400 text-sm font-semibold">
                            {h.total_loc?.toLocaleString()} lines
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "font-bold px-2.5 py-1 rounded-full text-xs border",
                                h.violations_count > 500
                                  ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                  : h.violations_count > 100
                                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                              )}
                            >
                              {h.violations_count} issues
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => handleRestore(h.id)}
                              disabled={loadingId === h.id}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                                loadingId === h.id
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                  : "bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5",
                              )}
                            >
                              {loadingId === h.id ? (
                                <Zap className="animate-spin" size={14} />
                              ) : (
                                <RotateCcw
                                  size={14}
                                  className="group-hover:scale-110 transition-transform"
                                />
                              )}
                              {loadingId === h.id ? "LOADING..." : "RESTORE"}
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={histPage}
              totalItems={historyList.length}
              pageSize={histPageSize}
              onPageChange={setHistPage}
              onPageSizeChange={setHistPageSize}
              showPageSizeSelector={true}
              label="records"
            />
          </motion.div>
        </>
      )}
    </div>
  );
};

export default HistoryView;
