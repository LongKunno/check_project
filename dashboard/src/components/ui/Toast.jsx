import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// ─── Config ──────────────────────────────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]',
  },
  error: {
    icon: XCircle,
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    glow: 'shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)]',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_20px_-4px_rgba(245,158,11,0.4)]',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-[0_0_20px_-4px_rgba(59,130,246,0.4)]',
  },
};

let _toastId = 0;

// ─── Toast Item ──────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }) {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl ${config.bg} ${config.border} ${config.glow} min-w-[300px] max-w-[420px]`}
    >
      <Icon size={18} className={`${config.text} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="text-sm font-bold text-white mb-0.5">{toast.title}</div>
        )}
        <div className="text-xs text-slate-300 leading-relaxed">{toast.message}</div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title = '', message = '', duration = 4000 }) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, title, message }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = useCallback({
    success: (message, title) => addToast({ type: 'success', title, message }),
    error: (message, title) => addToast({ type: 'error', title, message, duration: 6000 }),
    warning: (message, title) => addToast({ type: 'warning', title, message }),
    info: (message, title) => addToast({ type: 'info', title, message }),
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
