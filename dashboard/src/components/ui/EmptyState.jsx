import React from "react";
import { motion } from "framer-motion";
import { FolderOpen, AlertCircle, Search, Inbox } from "lucide-react";

const ILLUSTRATIONS = {
  empty: Inbox,
  noData: FolderOpen,
  error: AlertCircle,
  noResults: Search,
};

const COLOR_MAP = {
  slate: { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-500/60", orb: "bg-slate-500/5", dot1: "bg-slate-400/30", dot2: "bg-slate-400/20" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-500/60", orb: "bg-cyan-500/5", dot1: "bg-cyan-400/30", dot2: "bg-cyan-400/20" },
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-500/60", orb: "bg-indigo-500/5", dot1: "bg-indigo-400/30", dot2: "bg-indigo-400/20" },
  pink: { bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-500/60", orb: "bg-pink-500/5", dot1: "bg-pink-400/30", dot2: "bg-pink-400/20" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-500/60", orb: "bg-amber-500/5", dot1: "bg-amber-400/30", dot2: "bg-amber-400/20" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-500/60", orb: "bg-rose-500/5", dot1: "bg-rose-400/30", dot2: "bg-rose-400/20" },
};

/**
 * EmptyState — Beautiful empty state component with animated illustration.
 *
 * @param {string} variant — 'empty' | 'noData' | 'error' | 'noResults'
 * @param {string} title — Main heading
 * @param {string} description — Sub text
 * @param {React.ReactNode} action — Optional action button
 * @param {string} accentColor — Tailwind color key (slate, cyan, indigo, pink, amber, rose)
 */
export default function EmptyState({
  variant = "empty",
  title = "Nothing here yet",
  description = "",
  action = null,
  accentColor = "slate",
}) {
  const Icon = ILLUSTRATIONS[variant] || ILLUSTRATIONS.empty;
  const colors = COLOR_MAP[accentColor] || COLOR_MAP.slate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="relative text-center py-16 px-8 rounded-3xl border border-slate-200 bg-slate-50 overflow-hidden"
    >
      {/* Animated background orbs */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] ${colors.orb} blur-[80px] rounded-full pointer-events-none`}
      />

      {/* Animated icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.15,
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
        className="relative mx-auto mb-6"
      >
        <div
          className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl ${colors.bg} border ${colors.border}`}
        >
          <Icon size={36} className={`${colors.text}`} />
        </div>

        {/* Floating dots animation */}
        <motion.div
          animate={{ y: [-4, 4, -4] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${colors.dot1}`}
        />
        <motion.div
          animate={{ y: [3, -3, 3] }}
          transition={{
            repeat: Infinity,
            duration: 2.5,
            ease: "easeInOut",
            delay: 0.5,
          }}
          className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full ${colors.dot2}`}
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-slate-800 font-bold text-xl mb-2"
        style={{ fontFamily: "Outfit, sans-serif" }}
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed"
        >
          {description}
        </motion.p>
      )}

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-6"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
