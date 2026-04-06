import React, { useState } from 'react';
import { Settings, AlertTriangle, Zap, Trash2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const SettingsView = ({ selectedRepoId, cn }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!selectedRepoId) return;
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    setIsResetting(true);
    try {
      const res = await fetch(`/api/rules?target=${encodeURIComponent(selectedRepoId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Success: All custom rules have been deleted and weights reset to default.');
      } else {
        alert('Server error while resetting rules.');
      }
    } catch (e) {
      alert('Network connection error.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-4xl mx-auto relative z-10">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-500/6 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-slate-500/6 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-semibold mb-4">
            <Settings size={16} /> System Settings
          </div>
          <h2
            className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-violet-400"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            SYSTEM SETTINGS
          </h2>
          <p className="text-slate-400 mt-2 font-medium text-sm lg:text-base max-w-xl">
            Manage configuration and parameters for the audit engine.
          </p>
        </div>
      </motion.div>

      {/* ── Danger Zone Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="border border-red-500/20 rounded-2xl p-6 bg-red-900/10">
          <h3 className="text-red-400 font-extrabold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
            <ShieldAlert size={16} /> Danger Zone
          </h3>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Reset all audit rules for project{' '}
            <strong className="text-white px-2 py-0.5 bg-black/50 rounded font-mono">
              {selectedRepoId || 'none selected'}
            </strong>{' '}
            to their original default state. All AI-generated custom rules and weight overrides will be permanently deleted, <span className="text-red-400 font-semibold">this cannot be undone</span>.
          </p>
          <button
            onClick={handleReset}
            disabled={!selectedRepoId || isResetting}
            className={cn(
              'px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2',
              !selectedRepoId || isResetting
                ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
                : confirmReset
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_24px_rgba(220,38,38,0.4)] animate-pulse'
                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50'
            )}
          >
            {isResetting ? <Zap className="animate-spin" size={18} /> : <Trash2 size={18} />}
            {isResetting ? 'DELETING DATA...' : confirmReset ? '⚠ CONFIRM RESET?' : 'RESET TO DEFAULTS'}
          </button>
          {confirmReset && (
            <p className="mt-3 text-xs text-red-400/70 font-medium">Click again to confirm. This action will cancel automatically in 3 seconds.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsView;
