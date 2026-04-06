/**
 * AuditView — Full audit dashboard UI.
 * Split from App.jsx to reduce file size and improve readability.
 */
import React from 'react';
import {
  Activity, Shield, ShieldCheck, AlertTriangle, CheckCircle, BarChart3,
  Code2, Search, Zap, FolderOpen, Upload, Sparkles, Users, Wand2
} from 'lucide-react';
import { Radar, Line, Doughnut, Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import TerminalLogs from '../ui/TerminalLogs';
import EmptyState from '../ui/EmptyState';
import HeroCard from '../ui/HeroCard';
import Pagination from '../ui/Pagination';
import {
  getScoreColorClass,
  getViolationDistributionData,
  getSeverityDistributionData,
  getTopProblematicFiles,
  getRuleBreakdownData,
  getRadarChartData,
  chartOptions
} from '../../utils/chartHelpers';
import { useMemo, useState } from 'react';

// ─── Feature Table (Inline Pillars) ───────────────────────────────────────────

const getScoreColorVal = (score10) => {
  if (score10 >= 9) return '#10b981';
  if (score10 >= 7) return '#3b82f6';
  if (score10 >= 5) return '#f59e0b';
  return '#ef4444';
};

const getScoreDotClass = (score100) => {
  if (score100 >= 90) return 'score-dot score-dot-emerald';
  if (score100 >= 80) return 'score-dot score-dot-blue';
  if (score100 >= 65) return 'score-dot score-dot-amber';
  if (score100 >= 45) return 'score-dot score-dot-orange';
  return 'score-dot score-dot-rose';
};

const thBase = { padding: '0.6rem 0.75rem', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#475569', fontWeight: 700 };

function PillarCell({ score }) {
  const color = getScoreColorVal(score);
  return (
    <td style={{ padding: '0.5rem 0.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '55px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 900, color, fontFamily: 'Outfit, sans-serif' }}>{score}</span>
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score * 10}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            style={{ height: '100%', background: color, borderRadius: '4px' }}
          />
        </div>
      </div>
    </td>
  );
}

function FeatureTable({ features }) {
  const entries = Object.entries(features).sort((a, b) => a[1].final - b[1].final);
  const pillarNames = entries.length > 0 ? Object.keys(entries[0][1].pillars) : [];
  const [ftPage, setFtPage] = useState(1);
  const [ftPageSize, setFtPageSize] = useState(10);
  const paged = entries.slice((ftPage - 1) * ftPageSize, ftPage * ftPageSize);

  return (
    <div className="glass-card col-span-4" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.05)', padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="metric-label" style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}>
          <FolderOpen size={16} /> MODULE BREAKDOWN
          <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
            {entries.length}
          </span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full premium-table" style={{ '--table-accent': 'rgba(59, 130, 246, 0.5)', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ ...thBase, textAlign: 'left', padding: '0.6rem 1.5rem' }}>Module</th>
              <th style={{ ...thBase, textAlign: 'left' }}>Score</th>
              {pillarNames.map(p => (
                <th key={p} style={{ ...thBase, textAlign: 'center' }}>{p.length > 5 ? p.slice(0, 5) + '.' : p}</th>
              ))}
              <th style={{ ...thBase, textAlign: 'right' }}>LOC</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Debt</th>
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
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td style={{ padding: '0.6rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FolderOpen size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.8rem' }}>{name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className={getScoreDotClass(feat.final)} />
                      <span style={{ fontWeight: 900, color: scoreColor, fontSize: '0.95rem', fontFamily: 'Outfit, sans-serif' }}>
                        {feat.final}
                      </span>
                      <div style={{ width: '40px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${feat.final}%`, height: '100%', background: scoreColor, borderRadius: '4px' }} />
                      </div>
                    </div>
                  </td>
                  {pillarNames.map(p => (
                    <PillarCell key={p} score={feat.pillars[p]} />
                  ))}
                  <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem' }}>
                    {feat.loc.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>
                    <span style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '0.7rem' }}>
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

const AuditView = ({
  // Data
  data, error, isAuditing, jobId,
  // Report state
  reportView, setReportView, selectedMember, setSelectedMember,
  activeLedgerTab,
  // Pagination
  visibleLimit, setVisibleLimit,
  // Fix suggestion
  fixingId, suggestions, fetchFixSuggestion,
  // Tab
  activeTab,
  // Severity helper
  getSeverityClass,
  cn
}) => {

  const chartCurrentViolations = useMemo(() => {
    if (!data) return [];
    if (reportView === 'project') return data.violations || [];
    return data.scores?.members?.[selectedMember]?.violations || [];
  }, [data, reportView, selectedMember]);

  const memoizedViolationDistData = useMemo(() => getViolationDistributionData(chartCurrentViolations), [chartCurrentViolations]);
  const memoizedSeverityDistData = useMemo(() => getSeverityDistributionData(chartCurrentViolations), [chartCurrentViolations]);
  const memoizedTopFiles = useMemo(() => getTopProblematicFiles(chartCurrentViolations), [chartCurrentViolations]);
  const memoizedRuleBreakdown = useMemo(() => getRuleBreakdownData(chartCurrentViolations), [chartCurrentViolations]);
  const topImprovements = useMemo(() => {
    if (!data || !data.scores) return [];
    if (reportView === 'project' && data.scores.features) {
       return Object.entries(data.scores.features)
         .sort((a,b) => a[1].final - b[1].final)
         .slice(0, 5)
         .map(([name, feat]) => ({ name, score: feat.final, debt: feat.debt_mins }));
    } else if (reportView === 'member' && selectedMember && data.scores.members?.[selectedMember]) {
       const mbr = data.scores.members[selectedMember];
       if(!mbr.pillars) return [];
       return Object.entries(mbr.pillars)
         .sort((a,b) => a[1] - b[1])
         .slice(0, 5)
         .map(([name, score]) => ({ name, score: Math.round(score * 10), debt: mbr.debt_mins }));
    }
    return [];
  }, [data, reportView, selectedMember]);

  return (
    <>
      {/* Terminal Mini (chỉ hiện khi đang quét) */}
      <TerminalLogs isAuditing={isAuditing} jobId={jobId} />

      {/* Thông báo lỗi */}
      {error && (
        <div className="glass-card" style={{ borderColor: 'var(--accent-red)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
          <AlertTriangle size={24} />
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {data ? (
        <>
          {/* TOP LEVEL TOGGLE */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setReportView('project')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${reportView === 'project' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              <Activity size={16} /> Project View
            </button>
            <button
              onClick={() => {
                setReportView('member');
                if (!selectedMember && data.scores.members && Object.keys(data.scores.members).length > 0) {
                  setSelectedMember(Object.keys(data.scores.members)[0]);
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${reportView === 'member' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
              disabled={!data.scores.members || Object.keys(data.scores.members).length === 0}
            >
              <Users size={16} /> Team Analytics
            </button>
          </div>

          {/* Member Selector */}
          {reportView === 'member' && data.scores.members && Object.keys(data.scores.members).length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Author:</span>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', outline: 'none', fontSize: '1rem', cursor: 'pointer', minWidth: '200px' }}
              >
                {Object.keys(data.scores.members).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* STATS GRID */}
          <div className="stats-grid">
            {/* HERO CARD */}
            <HeroCard
              data={data}
              reportView={reportView}
              selectedMember={selectedMember}
              chartCurrentViolations={chartCurrentViolations}
              topImprovements={topImprovements}
            />

            {/* FEATURE TABLE (Collapsible rows) */}
            {reportView === 'project' && Object.keys(data?.scores?.features || {}).length > 0 && (
              <FeatureTable features={data.scores.features} />
            )}

            {/* MEMBER LEADERBOARD */}
            {reportView === 'project' && data?.scores?.members && Object.keys(data.scores.members).length > 0 && (
              <div className="glass-card col-span-4" style={{ marginTop: '0.5rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px' }}>
                <div className="metric-label" style={{ color: '#10b981', fontWeight: 800, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}>
                  <Users size={18} /> TEAM LEADERBOARD
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Author</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Total LOC</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Score</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Penalty</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Debt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data?.scores?.members || {})
                        .sort((a, b) => (b[1]?.final || 0) - (a[1]?.final || 0))
                        .map(([author, res]) => {
                          const totalPenalty = Object.values(res.punishments || {}).reduce((acc, curr) => acc + curr, 0);
                          return (
                            <tr key={author} style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#f8fafc', borderRadius: '8px 0 0 8px' }}>{author}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8' }}>{res.loc.toLocaleString()} lines</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: getScoreColorClass(res.final / 10), fontWeight: 800, fontSize: '1.1rem' }}>{res.final}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: '#ef4444', fontWeight: 700 }}>{Math.abs(totalPenalty).toFixed(2)}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: '#f59e0b', fontWeight: 700, borderRadius: '0 8px 8px 0' }}>{res.debt_mins}m</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* CHARTS ROW */}
          <div className="charts-row">
            <div className="chart-card glass-card" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="chart-title" style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}><Activity size={18} color="#3b82f6" /> VIOLATION DISTRIBUTION</h3>
              <div className="chart-container" style={{ height: '240px' }}>
                {memoizedViolationDistData && <Doughnut data={memoizedViolationDistData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { weight: '600', size: 10 } } } } }} />}
              </div>
            </div>
            <div className="chart-card glass-card" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="chart-title" style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}><Shield size={18} color="#ef4444" /> IMPACT SEVERITY</h3>
              <div className="chart-container" style={{ height: '240px' }}>
                {memoizedSeverityDistData && <Bar data={memoizedSeverityDistData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } }, plugins: { legend: { display: false } } }} />}
              </div>
            </div>
          </div>

          {/* RULE BREAKDOWN */}
          {memoizedRuleBreakdown && memoizedRuleBreakdown.length > 0 && (
            <div className="glass-card mb-6" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="metric-label" style={{ color: '#10b981', fontWeight: 800, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}>
                <ShieldCheck size={18} /> RULE BREAKDOWN
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'rgba(15,23,42,0.9)', zIndex: 10 }}>
                    <tr style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Rule ID</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Count</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Total Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memoizedRuleBreakdown.map((rule, idx) => (
                      <tr key={idx} style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#f8fafc', borderRadius: '8px 0 0 8px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{rule.id}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#f59e0b', textAlign: 'center', fontWeight: 'bold' }}>{rule.count}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#ef4444', fontWeight: 800, textAlign: 'center', borderRadius: '0 8px 8px 0' }}>{Math.abs(rule.weight).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MAIN GRID: Violations + Sidebar */}
          <div className="main-grid">
            {/* VIOLATION LEDGER */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div className="metric-label" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Code2 size={16} /> VIOLATION LEDGER</span>
                  <span>{activeLedgerTab === 'project' ? (data?.violations?.length || 0) : (data?.scores?.members ? Object.keys(data.scores.members).length : 0)} {activeLedgerTab === 'project' ? 'issues' : 'members'}</span>
                </div>
              </div>

              <div className="violation-list" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {(() => {
                  const currentViolations = reportView === 'project' ? (data?.violations || []) : (data?.scores?.members?.[selectedMember]?.violations || []);
                  const displayedViolations = currentViolations.slice(0, visibleLimit);
                  return (
                    <>
                      {displayedViolations.map((v, i) => (
                        <div
                          key={i}
                          className="violation-item"
                          style={{
                            borderLeftColor: v.weight <= -5 ? '#ef4444' : v.weight <= -3 ? '#f59e0b' : '#3b82f6',
                            background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px',
                            marginBottom: '0.75rem', borderWidth: '1px', borderStyle: 'solid',
                            borderColor: 'rgba(255,255,255,0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span className="violation-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem' }}>
                              {v.is_custom && <Sparkles size={14} style={{ color: '#f59e0b' }} title="Custom Rule" />}
                              {v.reason}
                            </span>
                            <span className={`status-badge ${getSeverityClass(v.weight)}`} style={{ fontWeight: 700, fontSize: '0.65rem' }}>
                              {v.is_custom ? 'CUSTOM' : v.pillar} | {v.weight >= 0 ? `+${v.weight}` : v.weight}
                            </span>
                          </div>
                          <div className="violation-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                            <Search size={12} color="#60a5fa" />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v.file}{v.line ? `:${v.line}` : ''}</span>
                          </div>
                          {v.snippet && (
                            <>
                              <pre style={{ marginTop: '1rem', padding: '1.25rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', fontSize: '0.85rem', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                                <code style={{ color: '#bae6fd', fontWeight: 500 }}>{v.snippet}</code>
                              </pre>
                              <button
                                className="btn-fix"
                                onClick={() => fetchFixSuggestion(v)}
                                disabled={fixingId === v.id}
                                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                              >
                                <Wand2 size={14} />
                                {fixingId === v.id ? 'Thinking...' : suggestions[v.id] ? 'Re-generate' : 'Fix'}
                              </button>
                              {suggestions[v.id] && (
                                <div className="fix-suggestion-block" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                  <div className="suggestion-header" style={{ color: '#10b981', fontWeight: 700, fontSize: '0.7rem', marginBottom: '0.4rem', textTransform: 'uppercase' }}>AI FIX</div>
                                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Recommended approach:</div>
                                  <code style={{ background: 'rgba(0,0,0,0.5)', padding: '0.75rem', borderRadius: '6px', display: 'block', color: '#bae6fd', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>{suggestions[v.id]}</code>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}

                      {currentViolations.length > visibleLimit && (
                        <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                          <button
                            onClick={() => setVisibleLimit(prev => prev + 50)}
                            style={{ padding: '0.5rem 1.5rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem', fontWeight: 500 }}
                          >
                            Show more ({currentViolations.length - visibleLimit} remaining)
                          </button>
                        </div>
                      )}

                      {currentViolations.length === 0 && reportView === 'project' && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                          <CheckCircle size={48} style={{ marginBottom: '1rem', color: 'var(--accent-green)', opacity: 0.5 }} />
                          <p>All clear! No violations found.</p>
                        </div>
                      )}

                      {reportView === 'member' && currentViolations.length === 0 && (!data.scores.members || Object.keys(data.scores.members).length === 0) && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                          <p>Git history is empty. Member report unavailable.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* SIDEBAR INFO */}
            <div className="sidebar">
              <div className="glass-card">
                <div className="metric-label">AUDIT INFO</div>
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                    <span style={{ fontWeight: 600 }}>{data?.project_name || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Files scanned:</span>
                    <span>{data?.metrics?.total_files || 0} files</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Standard:</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>V3 Stable</span>
                  </div>
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', textAlign: 'center' }}>
                      Results validated via AST syntax tree analysis.
                    </p>
                  </div>
                </div>

                {/* Top Problematic Files */}
                {memoizedTopFiles.length > 0 && (
                  <div className="glass-card" style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem', color: 'var(--text-main)' }}>
                      <FolderOpen size={18} color="var(--accent-yellow)" /> TOP PROBLEMATIC FILES
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {memoizedTopFiles.map(([filename, count], idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', wordBreak: 'break-all', paddingRight: '1rem' }}>{filename}</span>
                          <span className="status-badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', whiteSpace: 'nowrap' }}>{count} issues</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
