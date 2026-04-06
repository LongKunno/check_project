import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, FolderOpen, Code2, AlertTriangle, BarChart3,
  Loader2, CheckCircle2, XCircle, Clock, ArrowRight,
  Zap, RefreshCw, ChevronUp, ChevronDown, Trophy, Star,
  TrendingUp, AlertCircle
} from 'lucide-react';
import TerminalLogs from '../ui/TerminalLogs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRatingColor = (rating) => {
  if (!rating) return 'bg-slate-700/50 text-slate-400 border-slate-600';
  const r = rating.toLowerCase();
  if (r.includes('excellent') || r.includes('xuất sắc')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (r.includes('good') || r.includes('tốt'))     return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  if (r.includes('fair') || r.includes('khá'))     return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  if (r.includes('average') || r.includes('trung'))  return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
};

const getScoreColor = (score) => {
  if (score == null) return 'text-slate-500';
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-blue-400';
  if (score >= 65) return 'text-amber-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-rose-400';
};

const getScoreGradient = (score) => {
  if (score == null) return 'from-slate-600 to-slate-800';
  if (score >= 90) return 'from-emerald-400 to-teal-500';
  if (score >= 80) return 'from-blue-400 to-indigo-500';
  if (score >= 65) return 'from-amber-400 to-orange-500';
  return 'from-rose-400 to-red-600';
};

const formatDate = (ts) =>
  ts
    ? new Date(ts).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

const SCAN_STATUS = { IDLE: 'idle', RUNNING: 'running', DONE: 'done', ERROR: 'error' };

// ─── Scan All — sequential queue hook ────────────────────────────────────────

function useScanAllQueue(projects, onFinishAll) {
  const [scanStates, setScanStates] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const pollTimerRef = useRef(null);

  const startPolling = useCallback((jobId) => {
    setActiveJobId(jobId);
    setIsScanning(true);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/audit/jobs/${jobId}`);
        if (!res.ok) throw new Error('Connection error');
        const data = await res.json();

        if (data.result?.projects) {
          const newStates = {};
          Object.keys(data.result.projects).forEach(pid => {
            const pData = data.result.projects[pid];
            let st = SCAN_STATUS.IDLE;
            if (pData.status === 'PENDING')   st = SCAN_STATUS.IDLE;
            if (pData.status === 'RUNNING')   st = SCAN_STATUS.RUNNING;
            if (pData.status === 'COMPLETED') st = SCAN_STATUS.DONE;
            if (pData.status === 'FAILED')    st = SCAN_STATUS.ERROR;
            newStates[pid] = {
              status: st,
              message: pData.message || (st === SCAN_STATUS.DONE ? 'Done' : st === SCAN_STATUS.RUNNING ? 'Analyzing...' : ''),
            };
          });
          setScanStates(prev => ({ ...prev, ...newStates }));
        }

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsScanning(false);
          onFinishAll?.();
        }
      } catch { /* ignore transient errors */ }
    }, 2000);
  }, [onFinishAll]);

  useEffect(() => {
    const checkActiveBatch = async () => {
      try {
        const res = await fetch('/api/audit/batch/active');
        const data = await res.json();
        if (data.has_active && data.job_id) startPolling(data.job_id);
      } catch {}
    };
    checkActiveBatch();
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [startPolling]);

  const startScanAll = useCallback(async () => {
    if (isScanning || projects.length === 0) return;
    const init = {};
    projects.forEach(p => { init[p.id] = { status: SCAN_STATUS.IDLE, message: '' }; });
    setScanStates(init);
    try {
      const res = await fetch('/api/audit/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_ids: projects.map(p => p.id) }),
      });
      const data = await res.json();
      if (data.job_id) startPolling(data.job_id);
    } catch (e) {
      console.error('Lỗi khi khởi chạy batch:', e);
    }
  }, [projects, isScanning, startPolling]);

  const stopScan = useCallback(() => {
    fetch('/api/audit/cancel', { method: 'POST' }).catch(() => {});
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsScanning(false);
    setActiveJobId(null);
  }, []);

  return { scanStates, isScanning, activeJobId, startScanAll, stopScan };
}

// ─── Medal ────────────────────────────────────────────────────────────────────

function Medal({ rank }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-sm font-black text-slate-500 w-6 text-center">#{rank}</span>;
}

// ─── Scan Status Pill ─────────────────────────────────────────────────────────

function ScanPill({ state }) {
  if (!state || state.status === SCAN_STATUS.IDLE) return null;
  const cfg = {
    [SCAN_STATUS.RUNNING]: { icon: <Loader2 size={10} className="animate-spin" />, text: 'Scanning', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
    [SCAN_STATUS.DONE]:    { icon: <CheckCircle2 size={10} />, text: 'Done',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    [SCAN_STATUS.ERROR]:   { icon: <XCircle size={10} />,     text: 'Error',    cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  }[state.status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.cls}`}>
      {cfg.icon}{cfg.text}
    </span>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const pct = Math.min(Math.max(((score ?? 0) / 100) * 100, 0), 100);
  const colorClass =
    score >= 90 ? 'bg-emerald-500' :
    score >= 80 ? 'bg-blue-500' :
    score >= 65 ? 'bg-amber-500' :
    score >= 45 ? 'bg-orange-500' : 'bg-rose-500';
  return (
    <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full ${colorClass} transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Sort Th ──────────────────────────────────────────────────────────────────

function SortTh({ label, field, sortBy, sortDir, onClick, align = 'left' }) {
  const active = sortBy === field;
  return (
    <th
      className={`px-4 py-3 text-${align} cursor-pointer select-none group`}
      onClick={() => onClick(field)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        <span className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${active ? 'text-pink-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
          {label}
        </span>
        {active
          ? sortDir === 'desc' ? <ChevronDown size={12} className="text-pink-400" /> : <ChevronUp size={12} className="text-pink-400" />
          : <ChevronDown size={12} className="text-slate-700 group-hover:text-slate-500 transition-colors" />}
      </div>
    </th>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function ProjectRow({ project, rank, scanState, onSelect }) {
  const isRunning = scanState?.status === SCAN_STATUS.RUNNING;
  const hasScore  = project.latest_score !== null && project.latest_score !== undefined;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={`group border-b border-white/5 cursor-pointer transition-colors ${
        isRunning ? 'bg-indigo-500/5' : 'hover:bg-white/3'
      }`}
      onClick={() => onSelect?.(project.id)}
    >
      {/* Rank */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-center">
          <Medal rank={rank} />
        </div>
      </td>

      {/* Project */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            isRunning
              ? 'bg-indigo-500/20 border-indigo-500/40 animate-pulse'
              : 'bg-gradient-to-br from-pink-500/20 to-indigo-500/20 border-white/10'
          }`}>
            <FolderOpen size={14} className={isRunning ? 'text-indigo-400' : 'text-pink-400'} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm truncate max-w-[180px]" title={project.name}>
              {project.name}
            </div>
            <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={project.url}>
              {project.url?.replace('https://', '')}
            </div>
          </div>
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-4">
        {hasScore ? (
          <div className="flex items-center gap-2.5">
            <span className={`text-xl font-black ${getScoreColor(project.latest_score)}`}>
              {parseFloat(project.latest_score).toFixed(1)}
            </span>
            <ScoreBar score={project.latest_score} />
          </div>
        ) : (
          <span className="text-slate-600 text-sm font-medium">Not scanned</span>
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {project.latest_rating ? (
            <span className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(project.latest_rating)}`}>
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
            <AlertTriangle size={13} className={project.violations_count > 0 ? 'text-amber-500' : 'text-slate-600'} />
            <span className={`text-sm font-bold ${project.violations_count > 100 ? 'text-rose-400' : project.violations_count > 20 ? 'text-amber-400' : 'text-slate-300'}`}>
              {project.violations_count ?? '—'}
            </span>
          </div>
        ) : <span className="text-slate-600 text-sm">—</span>}
      </td>

      {/* Last scan */}
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Clock size={12} className="text-slate-600" />
          <span className="text-xs text-slate-400 font-medium">{formatDate(project.latest_timestamp)}</span>
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

const ProjectScoresView = ({ cn, onSelectProject }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('latest_score');
  const [sortDir, setSortDir] = useState('desc');

  const fetchScores = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/repositories/scores');
      if (!res.ok) throw new Error('Unable to load score data');
      const data = await res.json();
      if (data.status === 'success') {
        setProjects(data.data);
      } else {
        setError(data.message || 'Error parsing response');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  const { scanStates, isScanning, activeJobId, startScanAll, stopScan } = useScanAllQueue(projects, fetchScores);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir('desc'); }
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
    if (typeof va === 'string') return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  // KPI
  const scanned = projects.filter(p => p.latest_score !== null);
  const avgScore = scanned.length
    ? (scanned.reduce((s, p) => s + p.latest_score, 0) / scanned.length).toFixed(1)
    : null;
  const totalViolations = scanned.reduce((s, p) => s + (p.violations_count || 0), 0);
  const topProject = scanned.length > 0
    ? [...scanned].sort((a, b) => b.latest_score - a.latest_score)[0]
    : null;

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-7xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pink-500/8 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/8 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-sm font-semibold mb-4">
              <BarChart3 size={16} /> Project Leaderboard
            </div>
            <h2
              className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-200 to-pink-400"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              PROJECT LEADERBOARD
            </h2>
            <p className="text-slate-400 mt-2 font-medium text-sm lg:text-base max-w-xl">
              Code quality leaderboard for all repositories based on their latest audit.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchScores}
              disabled={isLoading || isScanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
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
                <Zap size={15} className="group-hover:scale-110 transition-transform" />
                Scan All
              </button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        {!isLoading && projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: 'Total projects', value: projects.length, icon: <FolderOpen size={16} className="text-pink-400" /> },
              { label: 'Avg score', value: avgScore ? `${avgScore}/100` : '—', icon: <Star size={16} className="text-amber-400" /> },
              { label: 'Top project', value: topProject?.name?.split('_').join(' ') || '—', icon: <Trophy size={16} className="text-emerald-400" /> },
              { label: 'Total violations', value: totalViolations.toLocaleString(), icon: <AlertTriangle size={16} className="text-orange-400" /> },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/3 border border-white/8 backdrop-blur-sm">
                {s.icon}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{s.label}</div>
                  <div className="text-lg font-black text-white truncate max-w-[120px]">{s.value}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Scan progress */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 overflow-hidden"
            >
              <div className="flex items-center gap-3 text-sm text-indigo-300 font-medium mb-3">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>Batch scan in progress — state persists even after page reload...</span>
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
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="animate-spin text-pink-500 mb-4" size={40} />
          <p className="text-slate-400 font-medium animate-pulse">Loading leaderboard data...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center max-w-lg mx-auto">
          <AlertTriangle className="text-red-400 mx-auto mb-3" size={32} />
          <h3 className="text-red-400 font-bold text-lg mb-2">Data fetch error</h3>
          <p className="text-slate-300 text-sm">{error}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center p-20 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-xl">
          <AlertCircle size={48} className="text-slate-500 mx-auto mb-4" />
          <h3 className="text-white font-bold text-xl mb-2">No projects yet</h3>
          <p className="text-slate-400">Please configure repositories in system settings.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-4 py-3 text-center">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">#</span>
                  </th>
                  <SortTh label="Project" field="name" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                  <SortTh label="Score" field="latest_score" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                  <th className="px-4 py-3 text-left">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Rating</span>
                  </th>
                  <SortTh label="Violations" field="violations_count" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} align="right" />
                  <SortTh label="Last Audit" field="latest_timestamp" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} align="right" />
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((project, idx) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    rank={idx + 1}
                    scanState={scanStates[project.id]}
                    onSelect={onSelectProject}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">
              {scanned.length}/{projects.length} projects scanned
            </span>
            <span className="text-xs text-slate-600">Click a row to open the detailed Dashboard</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProjectScoresView;
