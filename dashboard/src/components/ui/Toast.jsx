import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

//  Context 
const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

//  Config
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    glow: "shadow-[0_4px_20px_-4px_rgba(16,185,129,0.2)]",
    progress: "bg-emerald-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-600",
    glow: "shadow-[0_4px_20px_-4px_rgba(244,63,94,0.2)]",
    progress: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-600",
    glow: "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.2)]",
    progress: "bg-amber-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    glow: "shadow-[0_4px_20px_-4px_rgba(59,130,246,0.2)]",
    progress: "bg-blue-500",
  },
};

let _toastId = 0;

//  Toast Item 
function ToastItem({ toast, onDismiss }) {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)", transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
      dragElastic={0.6}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.x > 100 || velocity.x > 500) {
          onDismiss(toast.id);
        }
      }}
      className={`relative overflow-hidden flex flex-col rounded-2xl border bg-white ${config.border} ${config.glow} min-w-[300px] max-w-[420px] cursor-grab active:cursor-grabbing backdrop-blur-md`}
    >
      <div className={`absolute inset-0 opacity-[0.25] ${config.bg} pointer-events-none`} />

      <div className="relative z-10 flex items-start gap-3 px-4 py-3.5">
        <div className={`p-1 rounded-xl ${config.bg} ${config.text} shrink-0 bg-white/50 border border-white`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          {toast.title && (
            <div className="text-sm font-black text-slate-800 mb-0.5 tracking-tight">
              {toast.title}
            </div>
          )}
          <div className="text-[13px] text-slate-600 leading-relaxed font-semibold">
            {toast.message}
          </div>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 p-1.5 -mr-1.5 -mt-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {toast.duration > 0 && (
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: toast.duration / 1000, ease: "linear" }}
          className={`absolute bottom-0 left-0 h-[4px] ${config.progress} opacity-50 shadow-[0_0_10px_rgba(currentColor,0.5)]`}
        />
      )}
    </motion.div>
  );
}

//  Provider 
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = "info", title = "", message = "", duration = 3000 }) => {
      const id = ++_toastId;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const toast = useCallback(
    {
      success: (message, title) =>
        addToast({ type: "success", title, message, duration: 3000 }),
      error: (message, title) =>
        addToast({ type: "error", title, message, duration: 5000 }),
      warning: (message, title) =>
        addToast({ type: "warning", title, message, duration: 4000 }),
      info: (message, title) => addToast({ type: "info", title, message, duration: 3000 }),
    },
    [addToast],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
