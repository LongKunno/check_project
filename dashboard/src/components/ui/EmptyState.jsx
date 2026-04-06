import React from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, AlertCircle, Search, Inbox } from 'lucide-react';

const ILLUSTRATIONS = {
  empty: Inbox,
  noData: FolderOpen,
  error: AlertCircle,
  noResults: Search,
};

/**
 * EmptyState — Beautiful empty state component with animated illustration.
 *
 * @param {string} variant — 'empty' | 'noData' | 'error' | 'noResults'
 * @param {string} title — Main heading
 * @param {string} description — Sub text
 * @param {React.ReactNode} action — Optional action button
 * @param {string} accentColor — Tailwind color class (e.g. 'amber', 'blue')
 */
export default function EmptyState({
  variant = 'empty',
  title = 'Nothing here yet',
  description = '',
  action = null,
  accentColor = 'slate',
}) {
  const Icon = ILLUSTRATIONS[variant] || ILLUSTRATIONS.empty;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="relative text-center py-16 px-8 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl overflow-hidden"
    >
      {/* Animated background orbs */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-${accentColor}-500/5 blur-[80px] rounded-full pointer-events-none`} />

      {/* Animated icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
        className="relative mx-auto mb-6"
      >
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-${accentColor}-500/10 border border-${accentColor}-500/20`}>
          <Icon size={36} className={`text-${accentColor}-500/60`} />
        </div>

        {/* Floating dots animation */}
        <motion.div
          animate={{ y: [-4, 4, -4] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-${accentColor}-400/30`}
        />
        <motion.div
          animate={{ y: [3, -3, 3] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', delay: 0.5 }}
          className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-${accentColor}-400/20`}
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-white font-bold text-xl mb-2"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed"
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
