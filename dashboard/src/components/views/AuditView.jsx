/**
 * AuditView — Toàn bộ giao diện Dashboard Audit.
 * Tách từ App.jsx để giảm kích thước file và cải thiện khả năng đọc.
 */
import React from 'react';
import {
  Activity, Shield, ShieldCheck, AlertTriangle, CheckCircle, BarChart3,
  Code2, Search, Zap, FolderOpen, Upload, Sparkles, Users, Wand2
} from 'lucide-react';
import { Radar, Line, Doughnut, Bar } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import TerminalLogs from '../ui/TerminalLogs';
import {
  getScoreColorClass,
  getViolationDistributionData,
  getSeverityDistributionData,
  getTopProblematicFiles,
  getRuleBreakdownData,
  getRadarChartData,
  chartOptions
} from '../../utils/chartHelpers';
import { useMemo } from 'react';

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
  const memoizedRadarData = useMemo(() => getRadarChartData(data, reportView, selectedMember), [data, reportView, selectedMember]);

  return (
    <>
      {/* Terminal Mini (chỉ hiện khi đang quét) */}
      <TerminalLogs isAuditing={isAuditing} jobId={jobId} />

      {/* Thông báo lỗi */}
      {error && (
        <div className="glass-card" style={{ borderColor: 'var(--accent-red)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
          <AlertTriangle size={24} />
          <div><strong>Lỗi thực thi:</strong> {error}</div>
        </div>
      )}

      {data ? (
        <>
          {/* TOP LEVEL TOGGLE */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', borderBottom: '1px solid rgba(15,23,42,0.05)', paddingBottom: '1.25rem' }}>
            <button
              onClick={() => setReportView('project')}
              style={{
                padding: '0.8rem 1.75rem',
                background: reportView === 'project' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: reportView === 'project' ? '#60a5fa' : '#94a3b8',
                border: reportView === 'project' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
                borderRadius: '12px', cursor: 'pointer', fontWeight: 800, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}
            >
              <Activity size={18} /> Project View
            </button>
            <button
              onClick={() => {
                setReportView('member');
                if (!selectedMember && data.scores.members && Object.keys(data.scores.members).length > 0) {
                  setSelectedMember(Object.keys(data.scores.members)[0]);
                }
              }}
              style={{
                padding: '0.8rem 1.75rem',
                background: reportView === 'member' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: reportView === 'member' ? '#a78bfa' : '#94a3b8',
                border: reportView === 'member' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
                borderRadius: '12px', cursor: 'pointer', fontWeight: 800, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}
              disabled={!data.scores.members || Object.keys(data.scores.members).length === 0}
            >
              <Users size={18} /> Team Analytics
            </button>
          </div>

          {/* Member Selector */}
          {reportView === 'member' && data.scores.members && Object.keys(data.scores.members).length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Tác giả:</span>
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
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="glass-card hero-card col-span-4"
              style={{
                borderColor: reportView === 'member' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                background: 'rgba(15, 23, 42, 0.6)',
                boxShadow: '0 20px 50px -15px rgba(0,0,0,0.5)'
              }}
            >
              <div className="hero-left">
                <div className="metric-label" style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {reportView === 'member' ? <><Users size={20} className="text-emerald-400" /> TỔNG QUAN THÀNH VIÊN: {selectedMember}</> : <><Activity size={20} className="text-blue-400" /> TỔNG QUAN DỰ ÁN</>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '1.25rem' }}>
                  <div className="metric-value" style={{
                    fontSize: '5rem', fontWeight: 900, lineHeight: '1', letterSpacing: '-0.03em',
                    color: getScoreColorClass((reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)) / 10)
                  }}>
                    {reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)}
                  </div>
                  <span style={{ fontSize: '1.5rem', color: '#64748b', marginLeft: '0.75rem', fontWeight: 700 }}>/ 100</span>
                </div>

                {reportView === 'project' && data?.scores?.rating && (
                  <div style={{ marginTop: '1.25rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem' }}>
                    XẾP HẠNG: <span className="status-badge" style={{ fontSize: '1.25rem', padding: '0.6rem 1.25rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '14px', color: '#f8fafc' }}>{data.scores.rating}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '2.5rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng số dòng Code</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc' }}>
                      {reportView === 'project' ? data?.metrics?.total_loc?.toLocaleString() : (data?.scores?.members?.[selectedMember]?.loc || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{reportView === 'project' ? 'Số lượng tính năng' : 'Nợ kỹ thuật'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: reportView === 'member' ? '#f59e0b' : '#f8fafc' }}>
                      {reportView === 'project' ? Object.keys(data?.scores?.features || {}).length : `${data?.scores?.members?.[selectedMember]?.debt_mins || 0}m`}
                    </div>
                  </div>
                </div>

                {/* 4 Pillars */}
                <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', width: '100%' }}>
                  {Object.entries(reportView === 'project' ? (data?.scores?.project_pillars || {}) : (data?.scores?.members?.[selectedMember]?.pillars || {})).map(([pillar, score]) => (
                    <div key={pillar}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{pillar}</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: getScoreColorClass(score) }}>{score}<span style={{ fontSize: '0.75rem', opacity: 0.5 }}>/10</span></span>
                      </div>
                      <div className="progress-track" style={{ height: '8px', background: 'rgba(15,23,42,0.05)', borderRadius: '10px' }}>
                        <div className="progress-fill" style={{ width: `${score * 10}%`, background: getScoreColorClass(score), boxShadow: `0 4px 12px ${getScoreColorClass(score)}33`, borderRadius: '10px' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-right">
                <div style={{ width: '100%', height: '100%', maxWidth: '380px', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.06))' }}>
                  {memoizedRadarData && <Radar data={memoizedRadarData} options={chartOptions} />}
                </div>
              </div>
            </motion.div>

            {/* FEATURE CARDS */}
            {reportView === 'project' && Object.entries(data?.scores?.features || {}).map(([name, feat]) => (
              <div key={name} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '16px' }}>
                <div className="metric-label" style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase' }}>
                  <FolderOpen size={14} /> {name}
                </div>
                <div className="metric-value" style={{ fontSize: '2.25rem', fontWeight: 800, color: getScoreColorClass(feat.final / 10), letterSpacing: '-0.02em' }}>
                  {feat.final}<span style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '2px' }}>/100</span>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(feat.pillars).map(([pillar, p_score]) => (
                    <div key={pillar} style={{ fontSize: '0.7rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>{pillar}</span>
                        <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{p_score}/10</span>
                      </div>
                      <div className="progress-track" style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                        <div className="progress-fill" style={{ width: `${p_score * 10}%`, backgroundColor: getScoreColorClass(p_score), borderRadius: '10px' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Zap size={10} /> {feat.debt_mins}m DEBT
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{feat.loc.toLocaleString()} LOC</div>
                </div>
              </div>
            ))}

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
                        <th style={{ padding: '0.75rem 0.5rem' }}>Debt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data?.scores?.members || {})
                        .sort((a, b) => (b[1]?.final || 0) - (a[1]?.final || 0))
                        .map(([author, res]) => (
                          <tr key={author} style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#f8fafc', borderRadius: '8px 0 0 8px' }}>{author}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8' }}>{res.loc.toLocaleString()} lines</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: getScoreColorClass(res.final / 10), fontWeight: 800, fontSize: '1.1rem' }}>{res.final}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: '#f59e0b', fontWeight: 700, borderRadius: '0 8px 8px 0' }}>{res.debt_mins}m</td>
                          </tr>
                        ))}
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
                <ShieldCheck size={18} /> THỐNG KÊ THEO LUẬT (RULE BREAKDOWN)
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'rgba(15,23,42,0.9)', zIndex: 10 }}>
                    <tr style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Mã Luật (Rule ID)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Số Lỗi</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Tổng Điểm Trừ</th>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Code2 size={16} /> SỔ CÁI VI PHẠM (VIOLATION LEDGER)</span>
                  <span>{activeLedgerTab === 'project' ? (data?.violations?.length || 0) : (data?.scores?.members ? Object.keys(data.scores.members).length : 0)} {activeLedgerTab === 'project' ? 'vấn đề' : 'thành viên'}</span>
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
                            Hiển thị thêm (Còn {currentViolations.length - visibleLimit} lỗi)
                          </button>
                        </div>
                      )}

                      {currentViolations.length === 0 && reportView === 'project' && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                          <CheckCircle size={48} style={{ marginBottom: '1rem', color: 'var(--accent-green)', opacity: 0.5 }} />
                          <p>Chúc mừng! Không tìm thấy vi phạm nào.</p>
                        </div>
                      )}

                      {reportView === 'member' && currentViolations.length === 0 && (!data.scores.members || Object.keys(data.scores.members).length === 0) && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                          <p>Lịch sử Git rỗng. Báo cáo thành viên không khả dụng.</p>
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
                <div className="metric-label">THÔNG TIN KIỂM TOÁN</div>
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                    <span style={{ fontWeight: 600 }}>{data?.project_name || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Số lượng file:</span>
                    <span>{data?.metrics?.total_files || 0} files</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tiêu chuẩn:</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>V3 Stable</span>
                  </div>
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', textAlign: 'center' }}>
                      Hệ thống đã xác thực kết quả dựa trên cây cú pháp AST.
                    </p>
                  </div>
                </div>

                {/* Top Problematic Files */}
                {memoizedTopFiles.length > 0 && (
                  <div className="glass-card" style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem', color: 'var(--text-main)' }}>
                      <FolderOpen size={18} color="var(--accent-yellow)" /> TOP FILE LỖI NHIỀU NHẤT
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {memoizedTopFiles.map(([filename, count], idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', wordBreak: 'break-all', paddingRight: '1rem' }}>{filename}</span>
                          <span className="status-badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', whiteSpace: 'nowrap' }}>{count} lỗi</span>
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
        /* Trạng thái trống */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', opacity: 0.4 }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <BarChart3 size={80} style={{ color: 'var(--accent-blue)' }} />
            <Upload size={32} style={{ position: 'absolute', bottom: -10, right: -10 }} />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-display)' }}>Sẵn sàng để đánh giá mã nguồn</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {activeTab === 'local' ? 'Chọn thư mục từ máy tính và nhấn nút ' : 'Chọn dự án từ danh sách phía trên và nhấn nút '}
            <strong>Chạy Kiểm Toán</strong>
          </p>
        </div>
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
