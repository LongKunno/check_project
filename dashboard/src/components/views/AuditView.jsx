/**
 * AuditView — Full audit dashboard UI.
 * Refactored: sub-components extracted to /audit/ directory.
 */
import React from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  FolderOpen,
  Package,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import TerminalLogs from "../ui/TerminalLogs";
import EmptyState from "../ui/EmptyState";
import HeroCard from "../ui/HeroCard";
import Pagination from "../ui/Pagination";
import ViolationLedger from "../audit/ViolationLedger";
import ChartsRow from "../audit/ChartsRow";
import RuleBreakdownTable from "../audit/RuleBreakdownTable";
import AuditSidebar from "../audit/AuditSidebar";
import TeamLeaderboard from "../audit/TeamLeaderboard";
import { usePaginationState } from "../../hooks/usePaginationState";
import {
  getScoreColorClass,
  getViolationDistributionData,
  getSeverityDistributionData,
  getTopProblematicFiles,
  getRuleBreakdownData,
} from "../../utils/chartHelpers";
import {
  getDependencyHealthMeta,
  getDependencyIssueSummary,
  getDependencyLifecycleMeta,
  getDependencyHealthSummaryLine,
} from "../../utils/dependencyHealthHelpers";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Feature Table (Inline — depends on local helpers) ──────────────────────

const getScoreColorVal = (score10) => {
  if (score10 >= 9) return "#10b981";
  if (score10 >= 7) return "#3b82f6";
  if (score10 >= 5) return "#f59e0b";
  return "#ef4444";
};

const getScoreDotClass = (score100) => {
  if (score100 >= 90) return "score-dot score-dot-emerald";
  if (score100 >= 80) return "score-dot score-dot-blue";
  if (score100 >= 65) return "score-dot score-dot-amber";
  if (score100 >= 45) return "score-dot score-dot-orange";
  return "score-dot score-dot-rose";
};

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const getMemberInitials = (member) => {
  if (!member) return "??";
  const localPart = member.split("@")[0] || member;
  const parts = localPart.split(/[._-]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts.slice(0, 2) : [localPart.slice(0, 2)])
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return initials || member.slice(0, 2).toUpperCase();
};

const thBase = {
  padding: "0.6rem 0.75rem",
  fontSize: "9px",
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  color: "#475569",
  fontWeight: 700,
};

function PillarCell({ score }) {
  const color = getScoreColorVal(score);
  return (
    <td style={{ padding: "0.5rem 0.5rem" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
          minWidth: "55px",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 900,
            color,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {score}
        </span>
        <div
          style={{
            width: "100%",
            height: "3px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score * 10}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            style={{ height: "100%", background: color, borderRadius: "4px" }}
          />
        </div>
      </div>
    </td>
  );
}

function FeatureTable({ features }) {
  const entries = Object.entries(features).sort(
    (a, b) => a[1].final - b[1].final,
  );
  const pillarNames =
    entries.length > 0 ? Object.keys(entries[0][1].pillars) : [];
  const [ftPage, setFtPage] = useState(1);
  const [ftPageSize, setFtPageSize] = useState(10);
  const { pageItems: paged } = usePaginationState({
    items: entries,
    currentPage: ftPage,
    pageSize: ftPageSize,
    onPageChange: setFtPage,
  });

  return (
    <div
      className="glass-card col-span-4"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        padding: 0,
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "1.25rem 1.5rem 0.75rem",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="metric-label"
          style={{
            color: "#3b82f6",
            fontWeight: 800,
            fontSize: "0.85rem",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textTransform: "uppercase",
          }}
        >
          <FolderOpen size={16} /> MODULE BREAKDOWN
          <span
            style={{
              background: "rgba(59,130,246,0.15)",
              color: "#60a5fa",
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            {entries.length}
          </span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          className="w-full premium-table"
          style={{
            "--table-accent": "rgba(59, 130, 246, 0.5)",
            minWidth: "800px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <th
                style={{
                  ...thBase,
                  textAlign: "left",
                  padding: "0.6rem 1.5rem",
                }}
              >
                Module
              </th>
              <th style={{ ...thBase, textAlign: "left" }}>Score</th>
              {pillarNames.map((p) => (
                <th key={p} style={{ ...thBase, textAlign: "center" }}>
                  {p.length > 5 ? p.slice(0, 5) + "." : p}
                </th>
              ))}
              <th style={{ ...thBase, textAlign: "right" }}>LOC</th>
              <th style={{ ...thBase, textAlign: "right" }}>Debt</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(([name, feat], idx) => {
              const scoreColor = getScoreColorClass(feat.final / 10);
              return (
                <motion.tr
                  key={name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <td style={{ padding: "0.6rem 1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <FolderOpen size={13} style={{ color: "#60a5fa", flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color: "#334155", fontSize: "0.8rem" }}>
                        {name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span className={getScoreDotClass(feat.final)} />
                      <span style={{ fontWeight: 900, color: scoreColor, fontSize: "0.95rem", fontFamily: "Outfit, sans-serif" }}>
                        {feat.final}
                      </span>
                      <div style={{ width: "40px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${feat.final}%`, height: "100%", background: scoreColor, borderRadius: "4px" }} />
                      </div>
                    </div>
                  </td>
                  {pillarNames.map((p) => (
                    <PillarCell key={p} score={feat.pillars[p]} />
                  ))}
                  <td style={{ padding: "0.6rem 1rem", textAlign: "right", color: "#94a3b8", fontSize: "0.75rem" }}>
                    {feat.loc.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.6rem 1rem", textAlign: "right" }}>
                    <span style={{ color: "#8b5cf6", fontWeight: 700, fontSize: "0.7rem" }}>
                      {feat.debt_mins}m
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={ftPage}
        totalItems={entries.length}
        pageSize={ftPageSize}
        onPageChange={setFtPage}
        onPageSizeChange={setFtPageSize}
        showPageSizeSelector={true}
        label="modules"
      />
    </div>
  );
}

// ─── Main AuditView Component ───────────────────────────────────────────────

const AuditView = ({
  data, error, isAuditing, jobId, auditProgress,
  reportView, setReportView,
  selectedMember, setSelectedMember,
  activeLedgerTab,
  visibleLimit, setVisibleLimit,
  fixingId, suggestions, fetchFixSuggestion,
  activeTab, getSeverityClass, cn,
}) => {
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const memberDropdownRef = useRef(null);
  const memberSearchInputRef = useRef(null);

  const chartCurrentViolations = useMemo(() => {
    if (!data) return [];
    if (reportView === "project") return data.violations || [];
    return data.scores?.members?.[selectedMember]?.violations || [];
  }, [data, reportView, selectedMember]);

  const memberOptions = useMemo(
    () => Object.keys(data?.scores?.members || {}),
    [data],
  );
  const hasMemberScores = memberOptions.length > 0;
  const memberRecentMonths = data?.metadata?.member_recent_months || 3;
  const filteredMemberOptions = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return memberOptions;
    return memberOptions.filter((member) => member.toLowerCase().includes(keyword));
  }, [memberOptions, memberSearch]);
  const aiCacheMeta = data?.metadata?.ai_cache || null;
  const aiCacheModeLabel =
    aiCacheMeta?.effective_mode === "read_write"
      ? "Cache: Read + Write"
      : aiCacheMeta?.effective_mode === "write_only"
        ? "Cache: Write Only"
        : "Cache: Disabled by Policy";
  const aiCacheModeClasses =
    aiCacheMeta?.effective_mode === "read_write"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : aiCacheMeta?.effective_mode === "write_only"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const dependencyHealth = data?.metadata?.dependency_health || null;
  const dependencyHealthMeta = getDependencyHealthMeta(
    dependencyHealth?.status,
    dependencyHealth?.summary,
  );
  const dependencyHealthLine = getDependencyHealthSummaryLine(
    dependencyHealth?.summary,
    dependencyHealth?.status,
  );
  const dependencyHighlightItems = useMemo(() => {
    const items = dependencyHealth?.items || [];
    const order = { warning: 0, hygiene: 1, pass: 2 };
    return [...items]
      .sort((left, right) => {
        const statusDelta = (order[left.status] ?? 9) - (order[right.status] ?? 9);
        if (statusDelta !== 0) return statusDelta;
        const issueDelta =
          (right.issue_types?.length || 0) - (left.issue_types?.length || 0);
        if (issueDelta !== 0) return issueDelta;
        return String(left.name || "").localeCompare(String(right.name || ""));
      })
      .slice(0, 6);
  }, [dependencyHealth]);

  const memoizedViolationDistData = useMemo(
    () => getViolationDistributionData(chartCurrentViolations),
    [chartCurrentViolations],
  );
  const memoizedSeverityDistData = useMemo(
    () => getSeverityDistributionData(chartCurrentViolations),
    [chartCurrentViolations],
  );
  const memoizedTopFiles = useMemo(
    () => getTopProblematicFiles(chartCurrentViolations),
    [chartCurrentViolations],
  );
  const memoizedRuleBreakdown = useMemo(
    () => getRuleBreakdownData(chartCurrentViolations),
    [chartCurrentViolations],
  );
  const topImprovements = useMemo(() => {
    if (!data || !data.scores) return [];
    if (reportView === "project" && data.scores.features) {
      return Object.entries(data.scores.features)
        .sort((a, b) => a[1].final - b[1].final)
        .slice(0, 5)
        .map(([name, feat]) => ({ name, score: feat.final, debt: feat.debt_mins }));
    } else if (reportView === "member" && selectedMember && data.scores.members?.[selectedMember]) {
      const mbr = data.scores.members[selectedMember];
      if (!mbr.pillars) return [];
      return Object.entries(mbr.pillars)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5)
        .map(([name, score]) => ({ name, score: Math.round(score * 10), debt: mbr.debt_mins }));
    }
    return [];
  }, [data, reportView, selectedMember]);

  useEffect(() => {
    if (!isMemberDropdownOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!memberDropdownRef.current?.contains(event.target)) {
        setIsMemberDropdownOpen(false);
        setMemberSearch("");
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMemberDropdownOpen(false);
        setMemberSearch("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMemberDropdownOpen]);

  useEffect(() => {
    if (!isMemberDropdownOpen) return undefined;
    const rafId = window.requestAnimationFrame(() => {
      memberSearchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isMemberDropdownOpen]);

  useEffect(() => {
    if (reportView !== "member") {
      setIsMemberDropdownOpen(false);
      setMemberSearch("");
    }
  }, [reportView]);

  return (
    <>
      {/* Terminal Mini */}
      <TerminalLogs isAuditing={isAuditing} jobId={jobId} progress={auditProgress} />

      {/* Error */}
      {error && (
        <div
          className="glass-card"
          style={{
            borderColor: "var(--accent-red)",
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            color: "var(--accent-red)",
          }}
        >
          <AlertTriangle size={24} />
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {data ? (
        <>
          {/* TOP LEVEL TOGGLE */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "center" }}>
            <button
              onClick={() => setReportView("project")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${reportView === "project" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
            >
              <Activity size={16} /> Project View
            </button>
            <button
              onClick={() => {
                setReportView("member");
                if (!selectedMember && hasMemberScores) {
                  setSelectedMember(memberOptions[0]);
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${reportView === "member" ? "bg-violet-500/15 text-violet-400 border border-violet-500/20" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
              disabled={!hasMemberScores}
              title={
                !hasMemberScores
                  ? `Không có dữ liệu đánh giá thành viên trong ${memberRecentMonths} tháng gần đây.`
                  : undefined
              }
            >
              <Users size={16} /> Team Analytics
            </button>
          </div>

          {!hasMemberScores && (
            <div
              className="glass-card"
              style={{
                marginBottom: "1.25rem",
                background: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#9a3412",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <AlertTriangle size={18} style={{ marginTop: "0.1rem", flexShrink: 0 }} />
              <div style={{ fontSize: "0.92rem", lineHeight: 1.6 }}>
                Chưa có dữ liệu đánh giá thành viên vì dự án không phát sinh thay đổi mã nguồn trong {memberRecentMonths} tháng gần đây.
              </div>
            </div>
          )}

          {/* Member Selector */}
          {reportView === "member" && hasMemberScores && (
            <div className="member-select-row">
              <div
                ref={memberDropdownRef}
                className={`member-select-shell ${isMemberDropdownOpen ? "member-select-shell-open" : ""}`}
              >
                <button
                  type="button"
                  className="member-select-trigger"
                  onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isMemberDropdownOpen}
                >
                  <span className="member-select-icon" aria-hidden="true">
                    <UserRound size={16} />
                  </span>
                  <span className="member-select-meta">Team member</span>
                  <span className="member-select-value">{selectedMember}</span>
                  <span className="member-select-caret" aria-hidden="true">
                    <ChevronDown size={14} />
                  </span>
                </button>

                {isMemberDropdownOpen && (
                  <div className="member-select-panel">
                    <div className="member-select-search">
                      <Search size={15} className="member-select-search-icon" />
                      <input
                        ref={memberSearchInputRef}
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search team member..."
                        className="member-select-search-input"
                      />
                    </div>

                    <div className="member-select-list" role="listbox" aria-label="Team members">
                      {filteredMemberOptions.length > 0 ? (
                        filteredMemberOptions.map((member) => (
                          <button
                            key={member}
                            type="button"
                            role="option"
                            aria-selected={selectedMember === member}
                            className={`member-select-item ${selectedMember === member ? "member-select-item-active" : ""}`}
                            onClick={() => {
                              setSelectedMember(member);
                              setIsMemberDropdownOpen(false);
                              setMemberSearch("");
                            }}
                          >
                            <span className="member-select-avatar" aria-hidden="true">
                              {getMemberInitials(member)}
                            </span>
                            <span className="member-select-item-content">
                              <span className="member-select-item-name">{member}</span>
                              <span className="member-select-item-meta">
                                {selectedMember === member ? "Currently selected" : "Switch author insights"}
                              </span>
                            </span>
                            {selectedMember === member && (
                              <span className="member-select-check" aria-hidden="true">
                                <Check size={15} />
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="member-select-empty">
                          No matching member found for "{memberSearch}".
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATS GRID */}
          <div className="stats-grid">
            <HeroCard
              data={data}
              reportView={reportView}
              selectedMember={selectedMember}
              chartCurrentViolations={chartCurrentViolations}
              topImprovements={topImprovements}
            />

            {/* Feature Table */}
            {reportView === "project" && Object.keys(data?.scores?.features || {}).length > 0 && (
              <FeatureTable features={data.scores.features} />
            )}

            {/* Team Leaderboard */}
            {reportView === "project" && (
              <TeamLeaderboard members={data?.scores?.members} />
            )}
          </div>

          {data?.ai_summary ? (
            <div
              className="glass-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                marginBottom: "1.5rem",
              }}
            >
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 font-bold text-indigo-700">
                  <Bot size={15} />
                  AI Summary
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  {data.ai_summary.total_requests || 0} requests
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  {Number(data.ai_summary.input_tokens || 0).toLocaleString()} in /{" "}
                  {Number(data.ai_summary.output_tokens || 0).toLocaleString()} out
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  {usdFmt.format(data.ai_summary.cost_usd || 0)}
                </div>
                {aiCacheMeta ? (
                  <div className={`rounded-xl border px-3 py-2 ${aiCacheModeClasses}`}>
                    {aiCacheModeLabel}
                  </div>
                ) : null}
                {data.ai_summary.blocked_requests ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                    {data.ai_summary.blocked_requests} blocked by budget
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {dependencyHealth ? (
            <div
              className="glass-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                marginBottom: "1.5rem",
              }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-bold ${dependencyHealthMeta.classes}`}
                  >
                    {dependencyHealth.status === "warning" ? (
                      <ShieldAlert size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                    Dependency Health
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                    {dependencyHealth.summary?.dependencies_total || 0} dependencies/images
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                    {dependencyHealthLine}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                      <Package size={15} />
                      Manifests
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(dependencyHealth.summary?.manifests_scanned || []).length ? (
                        dependencyHealth.summary.manifests_scanned.map((manifest) => (
                          <span
                            key={manifest}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-700"
                          >
                            {manifest}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">No manifest info</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="mb-3 text-sm font-bold text-slate-800">
                      Priority Items
                    </div>
                    {!dependencyHighlightItems.length ? (
                      <span className="text-sm text-slate-400">No dependency items detected.</span>
                    ) : (
                      <div className="space-y-3">
                        {dependencyHighlightItems.map((item) => (
                          <div
                            key={`${item.artifact_path}-${item.name}-${item.current_spec}`}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-800">
                                  {item.name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {item.artifact_path} · {item.ecosystem}
                                </div>
                              </div>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                                  item.status === "warning"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : item.status === "pass"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-100 text-slate-500"
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {item.resolved_version || item.current_spec || "—"}
                              {item.latest_version ? ` -> ${item.latest_version}` : ""}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getDependencyLifecycleMeta(item.lifecycle_status).classes}`}
                              >
                                {getDependencyLifecycleMeta(item.lifecycle_status).label}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {getDependencyIssueSummary(item)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* CHARTS ROW */}
          <ChartsRow
            violationDistData={memoizedViolationDistData}
            severityDistData={memoizedSeverityDistData}
          />

          {/* RULE BREAKDOWN */}
          <RuleBreakdownTable ruleBreakdown={memoizedRuleBreakdown} />

          {/* MAIN GRID: Violations + Sidebar */}
          <div className="main-grid">
            <ViolationLedger
              violations={chartCurrentViolations}
              reportView={reportView}
              fixingId={fixingId}
              suggestions={suggestions}
              fetchFixSuggestion={fetchFixSuggestion}
            />
            <AuditSidebar data={data} topFiles={memoizedTopFiles} />
          </div>
        </>
      ) : !isAuditing ? (
        <EmptyState
          variant="empty"
          title="Ready to audit your codebase"
          description="Select a project from the sidebar, then click Run Audit to start the analysis."
          accentColor="blue"
        />
      ) : null}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 2s linear infinite; color: var(--accent-yellow); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </>
  );
};

export default AuditView;
