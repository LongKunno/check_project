import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Trophy,
  AlertTriangle,
  Code2,
  Star,
  ChevronUp,
  ChevronDown,
  X,
  RefreshCw,
  Loader2,
  FolderOpen,
  TrendingUp,
  Clock,
  Award,
  ShieldCheck,
  Activity,
  Zap,
  AlertCircle,
} from "lucide-react";
import { TableSkeleton, CardSkeleton } from "../ui/SkeletonLoader";
import EmptyState from "../ui/EmptyState";
import Pagination from "../ui/Pagination";

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

const formatLoc = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
};

/** Convert raw minutes to human-readable: 1715 → "28h 35m" */
const formatDebt = (mins) => {
  if (mins == null || mins === 0) return "0m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const getDebtClass = (mins) => {
  if (mins <= 60) return "debt-low";
  if (mins <= 480) return "debt-medium";
  return "debt-high";
};

/** Generate a unique gradient based on a string hash */
const getAvatarGradient = (name) => {
  let hash = 0;
  const str = name || "?";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 65%, 50%), hsl(${h2}, 65%, 40%))`;
};

const PILLAR_ICONS = {
  Maintainability: <Code2 size={13} />,
  Security: <ShieldCheck size={13} />,
  Reliability: <Activity size={13} />,
  Performance: <Zap size={13} />,
};

const PILLAR_COLORS = {
  Maintainability: "text-violet-400",
  Security: "text-rose-400",
  Reliability: "text-blue-400",
  Performance: "text-amber-400",
};

// ─── Rank Badge (replaces emoji medals) ──────────────────────────────────────

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

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, pillar }) {
  const pct = Math.min(Math.max((score / 10) * 100, 0), 100);
  const colorMap = {
    Maintainability: "bg-violet-500",
    Security: "bg-rose-500",
    Reliability: "bg-blue-500",
    Performance: "bg-amber-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorMap[pillar] || "bg-slate-500"} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-bold w-6 text-right ${PILLAR_COLORS[pillar] || "text-slate-400"}`}
      >
        {score?.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Modal Chi tiết Thành viên ────────────────────────────────────────────────

function MemberDetailModal({ member, onClose }) {
  if (!member) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#080c14]/80 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#080c14]/70 backdrop-blur-xl border-b border-white/5 px-6 pt-6 pb-4 flex items-start justify-between z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-3">
                <Users size={12} /> Member Profile
              </div>
              <h2
                className="text-2xl font-black text-white"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                {member.author_name}
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">{member.email}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Score Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-white/5">
                <div
                  className={`text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br ${getScoreGradient(member.final_score)}`}
                >
                  {member.final_score?.toFixed(1)}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-bold">
                  / 100
                </div>
                <div
                  className={`mt-2 px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(member.rating)}`}
                >
                  {member.rating}
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Total LOC",
                    value: member.total_loc?.toLocaleString(),
                    icon: <Code2 size={14} className="text-cyan-400" />,
                  },
                  {
                    label: "Projects",
                    value: member.projects_count,
                    icon: <FolderOpen size={14} className="text-violet-400" />,
                  },
                  {
                    label: "Debt",
                    value: formatDebt(member.total_debt_mins),
                    icon: <Clock size={14} className="text-amber-400" />,
                    title: `${member.total_debt_mins} minutes`,
                  },
                  {
                    label: "Rank",
                    value: `#${member._rank}`,
                    icon: <Award size={14} className="text-emerald-400" />,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white/3 border border-white/5"
                  >
                    {s.icon}
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                        {s.label}
                      </div>
                      <div className="text-base font-black text-white">
                        {s.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pillar Scores */}
            {member.pillar_scores && (
              <div className="p-4 rounded-2xl bg-white/3 border border-white/5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  4-Pillar Breakdown
                </div>
                <div className="space-y-2.5">
                  {Object.entries(member.pillar_scores).map(
                    ([pillar, score]) => (
                      <div key={pillar}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={
                              PILLAR_COLORS[pillar] || "text-slate-400"
                            }
                          >
                            {PILLAR_ICONS[pillar]}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-300">
                            {pillar}
                          </span>
                        </div>
                        <ScoreBar score={score} pillar={pillar} />
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Project Breakdown */}
            {member.projects?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Project Breakdown ({member.projects.length})
                </div>
                <div className="space-y-2">
                  {member.projects.map((proj, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                          <FolderOpen size={13} className="text-slate-400" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {proj.project_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {proj.loc?.toLocaleString()} LOC — Debt:{" "}
                            {formatDebt(proj.debt_mins)}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-lg font-black ${getScoreColor(proj.score)}`}
                      >
                        {proj.score?.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function MemberRow({ member, rank, onClick }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="group border-b border-white/[0.06] hover:bg-white/[0.05] hover:border-l-2 hover:border-l-cyan-500/50 cursor-pointer transition-all duration-200"
      onClick={() => onClick({ ...member, _rank: rank })}
    >
      {/* Rank */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-center">
          <RankBadge rank={rank} />
        </div>
      </td>

      {/* Member */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="avatar-gradient"
            style={{
              background: getAvatarGradient(member.author_name || member.email),
            }}
          >
            {(member.author_name || member.email || "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm truncate">
              {member.author_name}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {member.email}
            </div>
          </div>
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className={getScoreDotClass(member.final_score)} />
          <span
            className={`text-xl font-black ${getScoreColor(member.final_score)}`}
          >
            {member.final_score?.toFixed(1)}
          </span>
          <span className="text-xs text-slate-600 font-medium">/100</span>
        </div>
      </td>

      {/* Rating */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(member.rating)}`}
        >
          {member.rating}
        </span>
      </td>

      {/* LOC */}
      <td className="px-4 py-4 text-right">
        <div className="font-bold text-white text-sm">
          {formatLoc(member.total_loc)}
        </div>
        <div className="text-[10px] text-slate-500">lines of code</div>
      </td>

      {/* Projects */}
      <td className="px-4 py-4 text-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
          <FolderOpen size={11} />
          {member.projects_count}
        </span>
      </td>

      {/* Debt */}
      <td className="px-4 py-4 text-right">
        <span
          className={`text-sm font-semibold ${getDebtClass(member.total_debt_mins)}`}
          title={`${member.total_debt_mins} minutes`}
        >
          {formatDebt(member.total_debt_mins)}
        </span>
      </td>

      {/* Arrow hint */}
      <td className="px-4 py-4">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500">
          <TrendingUp size={16} />
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

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
          className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${active ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`}
        >
          {label}
        </span>
        {active ? (
          sortDir === "desc" ? (
            <ChevronDown size={12} className="text-cyan-400" />
          ) : (
            <ChevronUp size={12} className="text-cyan-400" />
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const MemberScoresView = ({ cn }) => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("final_score");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedMember, setSelectedMember] = useState(null);
  const [memPage, setMemPage] = useState(1);
  const [memPageSize, setMemPageSize] = useState(10);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/members/scores");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.status === "success") {
        setMembers(data.data || []);
      } else {
        setError(data.message || "Unknown error");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const sorted = [...members].sort((a, b) => {
    const va = a[sortBy] ?? 0;
    const vb = b[sortBy] ?? 0;
    return sortDir === "desc" ? vb - va : va - vb;
  });

  // KPI Stats
  const topPerformer =
    members.length > 0
      ? [...members].sort((a, b) => b.final_score - a.final_score)[0]
      : null;
  const avgScore =
    members.length > 0
      ? (
          members.reduce((s, m) => s + m.final_score, 0) / members.length
        ).toFixed(1)
      : null;
  const totalLoc = members.reduce((s, m) => s + m.total_loc, 0);

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-7xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/8 blur-[130px] rounded-full pointer-events-none -z-10" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
                <Users size={14} /> Team Leaderboard
              </div>
              <span className="text-slate-600 text-xs font-medium hidden sm:block">
                Individual quality across all repositories (3 months)
              </span>
            </div>
            <h2
              className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              MEMBER LEADERBOARD
            </h2>
          </div>

          <button
            onClick={fetchMembers}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-all disabled:opacity-40 shrink-0"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* KPI Strip */}
        {!isLoading && members.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              {
                label: "Total members",
                value: members.length,
                icon: <Users size={16} className="text-cyan-400" />,
                accent:
                  "border-cyan-500/25 shadow-[0_0_15px_-5px_rgba(6,182,212,0.15)]",
                accentLine: "kpi-accent-cyan",
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
                label: "Top Performer",
                value: topPerformer?.author_name?.split(" ").pop() || "—",
                icon: <Trophy size={16} className="text-emerald-400" />,
                accent:
                  "border-emerald-500/25 shadow-[0_0_15px_-5px_rgba(16,185,129,0.15)]",
                accentLine: "kpi-accent-emerald",
              },
              {
                label: "Total LOC contributed",
                value: formatLoc(totalLoc),
                icon: <Code2 size={16} className="text-violet-400" />,
                accent:
                  "border-violet-500/25 shadow-[0_0_15px_-5px_rgba(139,92,246,0.15)]",
                accentLine: "kpi-accent-violet",
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
      </motion.div>

      {isLoading ? (
        <div className="space-y-6">
          <CardSkeleton count={4} />
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          title="Data load error"
          description={error}
          accentColor="rose"
          action={
            <button
              onClick={fetchMembers}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-bold hover:bg-cyan-500/20 transition-all"
            >
              <RefreshCw size={14} /> Retry
            </button>
          }
        />
      ) : members.length === 0 ? (
        <EmptyState
          variant="noData"
          title="No member data yet"
          description="Run at least one Audit on a repository with Git history to collect member data via git blame."
          accentColor="cyan"
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#080c14]/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table
              className="w-full premium-table"
              style={{ "--table-accent": "rgba(6, 182, 212, 0.5)" }}
            >
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                  <th className="px-4 py-3 text-center">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                      #
                    </span>
                  </th>
                  <SortTh
                    label="Member"
                    field="author_name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                  />
                  <SortTh
                    label="Score"
                    field="final_score"
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
                    label="LOC"
                    field="total_loc"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                    align="right"
                  />
                  <SortTh
                    label="Projects"
                    field="projects_count"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onClick={handleSort}
                    align="center"
                  />
                  <SortTh
                    label="Debt"
                    field="total_debt_mins"
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
                  .slice((memPage - 1) * memPageSize, memPage * memPageSize)
                  .map((member, idx) => (
                    <MemberRow
                      key={member.email}
                      member={member}
                      rank={(memPage - 1) * memPageSize + idx + 1}
                      onClick={setSelectedMember}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={memPage}
            totalItems={sorted.length}
            pageSize={memPageSize}
            onPageChange={setMemPage}
            onPageSizeChange={setMemPageSize}
            showPageSizeSelector={true}
            label="members"
          />
        </motion.div>
      )}

      {/* Modal - Use Portal to escape transform wrapper */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedMember && (
              <MemberDetailModal
                member={selectedMember}
                onClose={() => setSelectedMember(null)}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
};
