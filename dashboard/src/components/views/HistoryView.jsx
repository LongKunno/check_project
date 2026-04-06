import React, { useState, useEffect } from 'react';
import { FileSearch, Zap, FolderOpen, RefreshCw, Clock, RotateCcw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getScoreColorClass } from '../../utils/chartHelpers';

const HistoryView = ({ selectedRepoId, targetUrl, onRestoreAudit, cn }) => {
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  const fetchTarget = targetUrl || selectedRepoId;

  const loadHistory = () => {
    if (!fetchTarget) return;
    setIsLoading(true);
    fetch(`/api/history?target=${encodeURIComponent(fetchTarget)}`)
      .then(r => r.json())
      .then(data => setHistoryList(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadHistory(); }, [targetUrl, selectedRepoId]);

  const handleRestore = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/history/${id}`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.full_json) {
          onRestoreAudit(detail.full_json);
        } else {
          alert('History report does not contain detailed JSON data.');
        }
      } else {
        alert('Error retrieving history details from the backend.');
      }
    } catch (e) {
      alert('Network connection error.');
    } finally {
      setLoadingId(null);
    }
  };

  const getRatingColor = (rating) => {
    if (!rating) return 'bg-slate-700/50 text-slate-400 border-slate-600';
    const r = rating.toLowerCase();
    if (r.includes('excellent') || r.includes('xuất sắc')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (r.includes('good') || r.includes('tốt'))     return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (r.includes('fair') || r.includes('khá'))     return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-6xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-amber-500/6 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-orange-500/6 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold mb-4">
              <FileSearch size={16} /> Audit History
            </div>
            <h2
              className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              AUDIT HISTORY
            </h2>
            <p className="text-slate-400 mt-2 font-medium text-sm lg:text-base max-w-xl">
              Look up and restore previous code analysis sessions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl font-mono text-sm text-slate-300 max-w-[220px] truncate" title={fetchTarget}>
              {fetchTarget || 'No project selected'}
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoading || !fetchTarget}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Content ── */}
      {!fetchTarget ? (
        <div className="text-center p-20 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-xl">
          <AlertCircle size={48} className="text-slate-500 mx-auto mb-4" />
          <h3 className="text-white font-bold text-xl mb-2">No project selected</h3>
          <p className="text-slate-400">Please choose a project from the sidebar to view its history.</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Zap className="animate-spin text-amber-500 mb-4" size={40} />
          <p className="text-slate-400 font-medium animate-pulse">Loading audit history...</p>
        </div>
      ) : historyList.length === 0 ? (
        <div className="text-center p-20 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-xl">
          <FolderOpen size={48} className="text-slate-500 mx-auto mb-4" />
          <h3 className="text-white font-bold text-xl mb-2">No audit history yet</h3>
          <p className="text-slate-400">Run at least one audit on this project to see its history.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  {['Scanned At', 'Rating', 'Score', 'Scale (LOC)', 'Violations', 'Action'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-widest font-bold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyList.map((h, idx) => {
                  const colorClass = getScoreColorClass(h.score / 10);
                  return (
                    <motion.tr
                      key={h.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
                          <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: colorClass, color: colorClass }} />
                          <Clock size={12} className="text-slate-600" />
                          {new Date(h.timestamp + 'Z').toLocaleString('en-US', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(h.rating)}`}>
                          {h.rating}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xl font-black" style={{ color: colorClass }}>
                          {h.score}
                        </span>
                        <span className="text-slate-600 text-xs ml-1 font-medium">/100</span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-sm font-semibold">
                        {h.total_loc?.toLocaleString()} lines
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-amber-500/90 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full text-xs border border-amber-500/20">
                          {h.violations_count} issues
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleRestore(h.id)}
                          disabled={loadingId === h.id}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
                            loadingId === h.id
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5'
                          )}
                        >
                          {loadingId === h.id
                            ? <Zap className="animate-spin" size={14} />
                            : <RotateCcw size={14} className="group-hover:scale-110 transition-transform" />
                          }
                          {loadingId === h.id ? 'LOADING...' : 'RESTORE'}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">
              {historyList.length} records • {fetchTarget?.split('/').pop() || fetchTarget}
            </span>
            <span className="text-xs text-slate-600">Click "Restore" to reload that session's dashboard</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default HistoryView;
