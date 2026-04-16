/**
 * AuditView — Full audit dashboard UI.
 * Refactored: sub-components extracted to /audit/ directory.
 */
import React from "react";
import {
  Activity,
  AlertTriangle,
  FolderOpen,
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
import {
  getScoreColorClass,
  getViolationDistributionData,
  getSeverityDistributionData,
  getTopProblematicFiles,
  getRuleBreakdownData,
} from "../../utils/chartHelpers";
import { useMemo, useState } from "react";

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
  const paged = entries.slice((ftPage - 1) * ftPageSize, ftPage * ftPageSize);

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
  data, error, isAuditing, jobId,
  reportView, setReportView,
  selectedMember, setSelectedMember,
  activeLedgerTab,
  visibleLimit, setVisibleLimit,
  fixingId, suggestions, fetchFixSuggestion,
  activeTab, getSeverityClass, cn,
}) => {
  const chartCurrentViolations = useMemo(() => {
    if (!data) return [];
    if (reportView === "project") return data.violations || [];
    return data.scores?.members?.[selectedMember]?.violations || [];
  }, [data, reportView, selectedMember]);

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

  return (
    <>
      {/* Terminal Mini */}
      <TerminalLogs isAuditing={isAuditing} jobId={jobId} />

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
                if (!selectedMember && data.scores.members && Object.keys(data.scores.members).length > 0) {
                  setSelectedMember(Object.keys(data.scores.members)[0]);
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${reportView === "member" ? "bg-violet-500/15 text-violet-400 border border-violet-500/20" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
              disabled={!data.scores.members || Object.keys(data.scores.members).length === 0}
            >
              <Users size={16} /> Team Analytics
            </button>
          </div>

          {/* Member Selector */}
          {reportView === "member" && data.scores.members && Object.keys(data.scores.members).length > 0 && (
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Author:</span>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                style={{
                  background: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  outline: "none",
                  fontSize: "1rem",
                  cursor: "pointer",
                  minWidth: "200px",
                }}
              >
                {Object.keys(data.scores.members).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
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
