import React from 'react';
import { motion } from 'framer-motion';

// ─── Table Skeleton ──────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex gap-4 px-6 py-4 border-b border-white/5 bg-white/2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton skeleton-line flex-1" style={{ width: `${60 + Math.random() * 40}%`, maxWidth: i === 0 ? 180 : 120 }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <motion.div
          key={rowIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: rowIdx * 0.06 }}
          className="flex items-center gap-4 px-6 py-5 border-b border-white/5"
        >
          {/* Avatar circle for first col */}
          <div className="skeleton skeleton-circle" style={{ width: 36, height: 36, flexShrink: 0 }} />
          {/* Text columns */}
          {Array.from({ length: cols - 1 }).map((_, colIdx) => (
            <div key={colIdx} className="flex-1">
              <div
                className="skeleton skeleton-line"
                style={{
                  width: colIdx === 0 ? `${50 + (rowIdx % 3) * 15}%` : `${30 + (rowIdx % 4) * 10}%`,
                  height: colIdx === 0 ? 16 : 12,
                  marginBottom: 0
                }}
              />
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Card Skeleton ───────────────────────────────────────────────────────────

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/3 border border-white/8 backdrop-blur-sm"
        >
          <div className="skeleton skeleton-circle" style={{ width: 32, height: 32 }} />
          <div className="flex-1">
            <div className="skeleton skeleton-line" style={{ width: '60%', height: 10, marginBottom: 8 }} />
            <div className="skeleton skeleton-line" style={{ width: '40%', height: 18, marginBottom: 0 }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Header Skeleton ─────────────────────────────────────────────────────────

export function HeaderSkeleton() {
  return (
    <div className="mb-8">
      <div className="skeleton" style={{ width: 140, height: 28, borderRadius: 9999, marginBottom: 16 }} />
      <div className="skeleton" style={{ width: '45%', height: 40, borderRadius: 12, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: '65%', height: 16, borderRadius: 8 }} />
    </div>
  );
}

// ─── Score Ring Skeleton ─────────────────────────────────────────────────────

export function ScoreRingSkeleton({ size = 120 }) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="45" className="score-ring-track" />
      </svg>
      <div className="absolute skeleton skeleton-circle" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

export default { TableSkeleton, CardSkeleton, HeaderSkeleton, ScoreRingSkeleton };
