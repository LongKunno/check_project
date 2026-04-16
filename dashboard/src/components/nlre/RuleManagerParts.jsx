/**
 * RuleManager shared sub-components.
 * Tách từ RuleManager.jsx (helpers + UI components, ~480 LOC).
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Gauge,
  Wrench,
  FlaskConical,
  Layers,
  Eye,
  EyeOff,
  GitCompare,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs) => twMerge(clsx(inputs));

/* ─── Pillar metadata ─────────────────────────────────────────────────── */
export const PILLAR_META = {
  Security: { icon: Lock, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", glow: "rgba(239,68,68,0.15)" },
  Performance: { icon: Gauge, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", glow: "rgba(245,158,11,0.15)" },
  Maintainability: { icon: Wrench, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", glow: "rgba(59,130,246,0.15)" },
  Reliability: { icon: FlaskConical, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", glow: "rgba(139,92,246,0.15)" },
  Uncategorized: { icon: Layers, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", glow: "rgba(100,116,139,0.15)" },
};

export const getPillarMeta = (cat) => PILLAR_META[cat] || PILLAR_META["Uncategorized"];

export const SEVERITY_META = {
  Blocker: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", bar: "#ef4444" },
  Critical: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", bar: "#f97316" },
  Major: { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500", bar: "#eab308" },
  Minor: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", bar: "#3b82f6" },
  Info: { color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400", bar: "#64748b" },
};

export const getSeverityMeta = (sev) => SEVERITY_META[sev] || SEVERITY_META["Info"];

/* ─── WeightInput ─────────────────────────────────────────────────────── */
export const WeightInput = ({ value, onChange, disabled, isOverride }) => {
  const step = 0.5;
  const inputRef = useRef(null);
  const stateRef = useRef({ value, onChange, disabled });
  useEffect(() => { stateRef.current = { value, onChange, disabled }; });

  const currentVal = parseFloat(value);
  const displayVal = isNaN(currentVal) ? -2.0 : currentVal;

  const increment = () => { if (!disabled) onChange((displayVal + step).toFixed(1)); };
  const decrement = () => { if (!disabled) onChange((displayVal - step).toFixed(1)); };

  useEffect(() => {
    const handleWheel = (e) => {
      const { value: v, onChange: cb, disabled: dis } = stateRef.current;
      if (dis) return;
      e.preventDefault();
      const cur = parseFloat(v);
      const base = isNaN(cur) ? -2.0 : cur;
      if (e.deltaY < 0) cb((base + step).toFixed(1));
      else cb((base - step).toFixed(1));
    };
    const el = inputRef.current;
    if (el) el.addEventListener("wheel", handleWheel, { passive: false });
    return () => { if (el) el.removeEventListener("wheel", handleWheel); };
  }, []);

  return (
    <div
      ref={inputRef}
      title="Hover & scroll để điều chỉnh"
      className={cn(
        "flex items-stretch rounded-lg overflow-hidden border transition-all duration-200",
        disabled
          ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50"
          : isOverride
            ? "border-violet-300 bg-violet-50"
            : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <button onClick={decrement} disabled={disabled} className="w-7 flex items-center justify-center text-slate-400 font-black text-xs hover:text-slate-700 hover:bg-slate-100 transition-colors border-r border-slate-200">−</button>
      <input
        type="number" step="0.5" value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-12 text-xs text-center font-bold font-mono outline-none bg-transparent cursor-ns-resize",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isOverride ? "text-violet-600" : "text-slate-700",
        )}
      />
      <button onClick={increment} disabled={disabled} className="w-7 flex items-center justify-center text-slate-400 font-black text-xs hover:text-slate-700 hover:bg-slate-100 transition-colors border-l border-slate-200">+</button>
    </div>
  );
};

/* ─── Animated KPI Card ───────────────────────────────────────────────── */
export const KpiCard = ({ icon: Icon, value, label, accent, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    className={cn(
      "relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 group cursor-default",
      "transition-all duration-300",
    )}
    style={{
      background: `linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`,
      borderColor: `${accent}30`,
      boxShadow: `0 1px 3px rgba(0,0,0,0.06)`,
    }}
  >
    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none transition-opacity duration-300 group-hover:opacity-40" style={{ background: accent }} />
    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: `${accent}20`, borderColor: `${accent}40` }}>
      <Icon size={22} style={{ color: accent }} />
    </div>
    <div className="flex flex-col">
      <span className="text-4xl font-black text-slate-800 leading-none tracking-tight">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: accent }}>{label}</span>
    </div>
  </motion.div>
);

/* ─── Filter Pill Group ────────────────────────────────────────────────── */
export const PillGroup = ({ options, value, onChange, label }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">{label}</span>
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap",
            value === opt.value ? "text-slate-800 shadow" : "text-slate-500 hover:text-slate-700",
          )}
          style={value === opt.value ? { background: opt.activeColor || "rgba(255,255,255,0.12)" } : {}}
        >
          {opt.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.dot }} />}
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

/* ─── Toggle Switch ────────────────────────────────────────────────────── */
export const ToggleSwitch = ({ checked, onChange }) => (
  <button onClick={onChange} className="flex items-center gap-2 group" title={checked ? "Click để tắt rule" : "Click để bật rule"}>
    <span className={cn("text-[10px] font-black uppercase tracking-wider transition-colors", checked ? "text-emerald-600" : "text-slate-400")}>{checked ? "ON" : "OFF"}</span>
    <div className={cn("relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-all duration-300", checked ? "bg-emerald-500" : "bg-slate-300")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300", checked ? "translate-x-5" : "translate-x-0.5")} />
    </div>
  </button>
);

/* ─── Rule Card ────────────────────────────────────────────────────────── */
export const RuleCard = ({
  ruleKey, meta, isDisabled, isCustomWeight, customWeight,
  onToggle, onWeightChange, isOverridden = false, onResetOverride = undefined,
  isGlobalCustomized = false, onResetToDefault = undefined,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sevMeta = getSeverityMeta(meta.severity);
  const pillarMeta = getPillarMeta(meta.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: isDisabled ? 0.4 : 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-xl border transition-all duration-300 overflow-hidden",
        isDisabled
          ? "bg-slate-50 border-slate-200 grayscale-[50%]"
          : isCustomWeight
            ? "bg-violet-50/50 border-violet-200 hover:border-violet-300"
            : "bg-white border-slate-200 hover:border-slate-300",
      )}
    >
      {!isDisabled && (
        <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${sevMeta.bar}88, transparent)` }} />
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Row 1: ID + badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className={cn("font-mono text-[12px] font-black px-2.5 py-1 rounded-md border", sevMeta.bg, sevMeta.color, sevMeta.border)}>{ruleKey}</code>
            <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border", sevMeta.bg, sevMeta.color, sevMeta.border)}>{meta.severity}</span>
            {isCustomWeight && !isOverridden && !isGlobalCustomized && (
              <span className="text-[9px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full border border-violet-200 font-black uppercase tracking-wide">✦ Custom Weight</span>
            )}
            {isOverridden && (
              <span className="text-[9px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 font-black uppercase tracking-wide flex items-center gap-1 cursor-pointer hover:bg-orange-100 transition-colors" title="This rule setting is explicitly overriding the Global preset">
                <GitCompare size={10} /> Override Active
              </span>
            )}
            {isGlobalCustomized && (
              <span className="text-[9px] bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full border border-cyan-200 font-black uppercase tracking-wide flex items-center gap-1" title="Rule này đã bị thay đổi so với mặc định gốc">
                ✎ Modified
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isOverridden && onResetOverride && (
              <button onClick={onResetOverride} className="text-[10px] text-slate-500 hover:text-slate-700 capitalize transition-colors font-bold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">Reset</button>
            )}
            {isGlobalCustomized && onResetToDefault && (
              <button onClick={onResetToDefault} className="text-[10px] text-cyan-600 hover:text-cyan-700 transition-colors font-bold bg-cyan-50 hover:bg-cyan-100 px-2 py-1 rounded border border-cyan-200 hover:border-cyan-300 flex items-center gap-1" title="Khôi phục rule về trạng thái mặc định gốc">
                <RotateCcw size={10} /> Default
              </button>
            )}
            <ToggleSwitch checked={!isDisabled} onChange={() => onToggle(!isDisabled)} />
          </div>
        </div>

        {/* Row 2: Description */}
        <p className="text-[13px] text-slate-600 leading-relaxed font-medium line-clamp-2">{meta.reason || meta.category}</p>

        {/* Row 3: footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <button onClick={() => setExpanded((p) => !p)} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors">
            {expanded ? <EyeOff size={12} /> : <Eye size={12} />}
            {expanded ? "Ẩn chi tiết" : "Xem pattern"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">WEIGHT</span>
            <WeightInput
              value={isCustomWeight ? customWeight : meta.weight !== undefined ? meta.weight : -2.0}
              onChange={onWeightChange}
              disabled={isDisabled}
              isOverride={isCustomWeight && !isDisabled}
            />
          </div>
        </div>

        {/* Expandable */}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                {meta.regex?.pattern && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-emerald-200">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block mb-1.5">Regex Pattern</span>
                    <code className="text-[11px] text-emerald-700 font-mono break-all leading-loose">{meta.regex.pattern}</code>
                  </div>
                )}
                {meta.ast?.type && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-blue-200 flex gap-6">
                    <div>
                      <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block mb-1">AST Type</span>
                      <span className="text-[11px] text-blue-700 font-mono">{meta.ast.type}</span>
                    </div>
                    {meta.ast.limit && (
                      <div>
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block mb-1">Limit</span>
                        <span className="text-[11px] text-blue-700 font-mono">{meta.ast.limit}</span>
                      </div>
                    )}
                  </div>
                )}
                {!meta.regex?.pattern && !meta.ast?.type && (
                  <span className="text-[11px] text-slate-600 italic">AI-Only rule — không có pattern tĩnh.</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ─── DiffCard ─────────────────────────────────────────────────────────── */
export const DiffCard = ({ ruleId, defaultRules, overrides, onReset }) => {
  const meta = defaultRules[ruleId] || {};
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-orange-200 rounded-xl overflow-hidden flex flex-col group">
      <div className="h-1 bg-gradient-to-r from-orange-500/50 to-transparent" />
      <div className="p-4 flex flex-col gap-2 relative">
        <div className="flex justify-between items-start">
          <div className="font-mono text-sm font-bold text-orange-600">{ruleId}</div>
          <button onClick={onReset} className="text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-xs font-bold transition-colors">Reset to Global</button>
        </div>
        <div className="text-xs text-slate-400 truncate pr-4">{meta.reason || "Unknown rule description"}</div>
        <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-2">
          {overrides.status && (
            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", overrides.status === "ENABLED" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
              OVERRIDE: {overrides.status}
            </span>
          )}
          {overrides.weight !== undefined && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
              OVERRIDE: WEIGHT={overrides.weight}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
