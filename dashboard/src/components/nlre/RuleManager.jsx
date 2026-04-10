import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Search,
  Wand2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Zap,
  Flame,
  Sparkles,
  Lock,
  Gauge,
  Wrench,
  FlaskConical,
  Info,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  X,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

/* ─── Pillar metadata ─────────────────────────────────────────────────── */
const PILLAR_META = {
  Security: {
    icon: Lock,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    glow: "rgba(239,68,68,0.25)",
  },
  Performance: {
    icon: Gauge,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "rgba(245,158,11,0.25)",
  },
  Maintainability: {
    icon: Wrench,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    glow: "rgba(59,130,246,0.25)",
  },
  Reliability: {
    icon: FlaskConical,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    glow: "rgba(139,92,246,0.25)",
  },
  Uncategorized: {
    icon: Layers,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    glow: "rgba(100,116,139,0.25)",
  },
};

const getPillarMeta = (cat) => PILLAR_META[cat] || PILLAR_META["Uncategorized"];

const SEVERITY_META = {
  Blocker: {
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    dot: "bg-red-400",
    bar: "#ef4444",
  },
  Critical: {
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    dot: "bg-orange-400",
    bar: "#f97316",
  },
  Major: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/30",
    dot: "bg-yellow-400",
    bar: "#eab308",
  },
  Minor: {
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
    bar: "#3b82f6",
  },
  Info: {
    color: "text-slate-400",
    bg: "bg-slate-500/15",
    border: "border-slate-500/30",
    dot: "bg-slate-400",
    bar: "#64748b",
  },
};

const getSeverityMeta = (sev) => SEVERITY_META[sev] || SEVERITY_META["Info"];

/* ─── WeightInput ─────────────────────────────────────────────────────── */
const WeightInput = ({ value, onChange, disabled, isOverride }) => {
  const step = 0.5;
  const inputRef = useRef(null);
  const currentVal = parseFloat(value);
  const displayVal = isNaN(currentVal) ? -2.0 : currentVal;

  const increment = () => {
    if (!disabled) onChange((displayVal + step).toFixed(1));
  };
  const decrement = () => {
    if (!disabled) onChange((displayVal - step).toFixed(1));
  };

  useEffect(() => {
    const handleWheel = (e) => {
      if (disabled) return;
      e.preventDefault();
      if (e.deltaY < 0) increment();
      else decrement();
    };
    const el = inputRef.current;
    if (el) el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      if (el) el.removeEventListener("wheel", handleWheel);
    };
  }, [displayVal, disabled]);

  return (
    <div
      ref={inputRef}
      title="Hover & scroll để điều chỉnh"
      className={cn(
        "flex items-stretch rounded-lg overflow-hidden border transition-all duration-200",
        disabled
          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/3"
          : isOverride
            ? "border-violet-500/50 bg-violet-900/20 shadow-[0_0_8px_rgba(139,92,246,0.2)]"
            : "border-white/10 bg-black/40 hover:border-white/20",
      )}
    >
      <button
        onClick={decrement}
        disabled={disabled}
        className="w-7 flex items-center justify-center text-slate-400 font-black text-xs hover:text-white hover:bg-white/10 transition-colors border-r border-white/5"
      >
        −
      </button>
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-12 text-xs text-center font-bold font-mono outline-none bg-transparent cursor-ns-resize",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isOverride ? "text-violet-300" : "text-slate-200",
        )}
      />
      <button
        onClick={increment}
        disabled={disabled}
        className="w-7 flex items-center justify-center text-slate-400 font-black text-xs hover:text-white hover:bg-white/10 transition-colors border-l border-white/5"
      >
        +
      </button>
    </div>
  );
};

/* ─── Animated KPI Card ───────────────────────────────────────────────── */
const KpiCard = ({ icon: Icon, value, label, accent, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    className={cn(
      "relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 group",
      "bg-[#0a0e1a]/80 backdrop-blur-md hover:bg-[#0d1120]/90 transition-all duration-300",
    )}
    style={{ borderColor: `${accent}40` }}
  >
    {/* Glow orb */}
    <div
      className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-xl pointer-events-none transition-opacity duration-300 group-hover:opacity-35"
      style={{ background: accent }}
    />
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
      style={{ background: `${accent}18`, borderColor: `${accent}35` }}
    >
      <Icon size={22} style={{ color: accent }} />
    </div>
    <div className="flex flex-col">
      <span className="text-3xl font-black text-white font-display leading-none">
        {value}
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-widest mt-1"
        style={{ color: `${accent}cc` }}
      >
        {label}
      </span>
    </div>
  </motion.div>
);

/* ─── Filter Pill Group ────────────────────────────────────────────────── */
const PillGroup = ({ options, value, onChange, label }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
      {label}
    </span>
    <div className="flex items-center gap-1 bg-black/30 rounded-xl p-1 border border-white/5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap",
            value === opt.value
              ? "text-white shadow"
              : "text-slate-500 hover:text-slate-300",
          )}
          style={
            value === opt.value
              ? { background: opt.activeColor || "rgba(255,255,255,0.12)" }
              : {}
          }
        >
          {opt.dot && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: opt.dot }}
            />
          )}
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

/* ─── Toggle Switch ────────────────────────────────────────────────────── */
const ToggleSwitch = ({ checked, onChange }) => (
  <button
    onClick={onChange}
    className="flex items-center gap-2 group"
    title={checked ? "Click để tắt rule" : "Click để bật rule"}
  >
    <span
      className={cn(
        "text-[10px] font-black uppercase tracking-wider transition-colors",
        checked ? "text-emerald-400" : "text-slate-600",
      )}
    >
      {checked ? "ON" : "OFF"}
    </span>
    <div
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-all duration-300 shadow-inner",
        checked
          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
          : "bg-slate-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </div>
  </button>
);

/* ─── Rule Card ────────────────────────────────────────────────────────── */
const RuleCard = ({
  ruleKey,
  meta,
  isDisabled,
  isCustomWeight,
  customWeight,
  onToggle,
  onWeightChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sevMeta = getSeverityMeta(meta.severity);
  const pillarMeta = getPillarMeta(meta.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: isDisabled ? 0.5 : 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-xl border transition-all duration-300 overflow-hidden",
        isDisabled
          ? "bg-slate-900/40 border-slate-800/50 grayscale-[60%]"
          : isCustomWeight
            ? "bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.08),transparent_60%)] border-violet-500/25 hover:border-violet-500/45"
            : "bg-black/30 border-white/8 hover:border-white/18 hover:bg-black/40",
      )}
    >
      {/* Severity accent top line */}
      {!isDisabled && (
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, ${sevMeta.bar}88, transparent)`,
          }}
        />
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Row 1: ID + badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <code
              className={cn(
                "font-mono text-[12px] font-black px-2.5 py-1 rounded-md border",
                sevMeta.bg,
                sevMeta.color,
                sevMeta.border,
              )}
            >
              {ruleKey}
            </code>
            <span
              className={cn(
                "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border",
                sevMeta.bg,
                sevMeta.color,
                sevMeta.border,
              )}
            >
              {meta.severity}
            </span>
            {isCustomWeight && (
              <span className="text-[9px] bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/25 font-black uppercase tracking-wide">
                ✦ Override
              </span>
            )}
          </div>
          <ToggleSwitch
            checked={!isDisabled}
            onChange={() => onToggle(!isDisabled)}
          />
        </div>

        {/* Row 2: Description */}
        <p className="text-[13px] text-slate-400 leading-relaxed font-medium line-clamp-2">
          {meta.reason || meta.category}
        </p>

        {/* Row 3: footer */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            {expanded ? <EyeOff size={12} /> : <Eye size={12} />}
            {expanded ? "Ẩn chi tiết" : "Xem pattern"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
              WEIGHT
            </span>
            <WeightInput
              value={
                isCustomWeight
                  ? customWeight
                  : meta.weight !== undefined
                    ? meta.weight
                    : -2.0
              }
              onChange={onWeightChange}
              disabled={isDisabled}
              isOverride={isCustomWeight && !isDisabled}
            />
          </div>
        </div>

        {/* Expandable */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                {meta.regex?.pattern && (
                  <div className="bg-black/40 rounded-lg p-3 border border-emerald-500/10">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block mb-1.5">
                      Regex Pattern
                    </span>
                    <code className="text-[11px] text-emerald-400 font-mono break-all leading-loose">
                      {meta.regex.pattern}
                    </code>
                  </div>
                )}
                {meta.ast?.type && (
                  <div className="bg-black/40 rounded-lg p-3 border border-blue-500/10 flex gap-6">
                    <div>
                      <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block mb-1">
                        AST Type
                      </span>
                      <span className="text-[11px] text-blue-400 font-mono">
                        {meta.ast.type}
                      </span>
                    </div>
                    {meta.ast.limit && (
                      <div>
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block mb-1">
                          Limit
                        </span>
                        <span className="text-[11px] text-blue-400 font-mono">
                          {meta.ast.limit}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {!meta.regex?.pattern && !meta.ast?.type && (
                  <span className="text-[11px] text-slate-600 italic">
                    AI-Only rule — không có pattern tĩnh.
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ─── Main Component ───────────────────────────────────────────────────── */
const RuleManager = ({ targetId, projectName }) => {
  const [defaultRules, setDefaultRules] = useState({});
  const [disabledCoreRules, setDisabledCoreRules] = useState([]);
  const [customWeights, setCustomWeights] = useState({});
  const [compiledJson, setCompiledJson] = useState(null);
  const [naturalText, setNaturalText] = useState("");
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState("core");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPillar, setFilterPillar] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedCategories, setExpandedCategories] = useState({});

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRules = async () => {
    if (!targetId) return;
    try {
      const res = await fetch(
        `/api/rules?target=${encodeURIComponent(targetId)}`,
      );
      const result = await res.json();
      if (result.status === "success" && result.data) {
        setDefaultRules(result.data.default_rules || {});
        setDisabledCoreRules(result.data.disabled_core_rules || []);
        setCustomWeights(result.data.custom_weights || {});
        setCompiledJson(result.data.compiled_json || null);
        setNaturalText(result.data.natural_text || "");
      }
    } catch (e) {
      console.error("Fetch rules error", e);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [targetId]);

  const handleToggleRule = async (ruleId, isDisable) => {
    try {
      const res = await fetch("/api/rules/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetId,
          rule_id: ruleId,
          is_disabled: isDisable,
        }),
      });
      if (res.ok) {
        showToast(`Rule ${ruleId} ${isDisable ? "disabled" : "enabled"}`);
        setDisabledCoreRules((prev) =>
          isDisable ? [...prev, ruleId] : prev.filter((r) => r !== ruleId),
        );
      }
    } catch (e) {
      showToast("Error updating rule", "error");
    }
  };

  const syncStateWithServer = async (updatedJson, updatedWeights) => {
    try {
      await fetch("/api/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: updatedJson,
          custom_weights: updatedWeights,
        }),
      });
    } catch (e) {}
  };

  const handleWeightChange = async (
    ruleId,
    newWeight,
    isCustomRule = false,
    customRuleType = null,
    customRuleIdx = null,
  ) => {
    const val = parseFloat(newWeight);
    if (isNaN(val)) return;

    if (isCustomRule) {
      if (!compiledJson) return;
      const updatedJson = JSON.parse(JSON.stringify(compiledJson));
      if (customRuleType === "regex" && Array.isArray(updatedJson.regex_rules))
        updatedJson.regex_rules[customRuleIdx].weight = val;
      else if (
        customRuleType === "ast" &&
        updatedJson.ast_rules?.dangerous_functions
      )
        updatedJson.ast_rules.dangerous_functions[customRuleIdx].weight = val;
      setCompiledJson(updatedJson);
      syncStateWithServer(updatedJson, customWeights);
      return;
    }

    const updatedWeights = { ...customWeights, [ruleId]: val };
    setCustomWeights(updatedWeights);
    syncStateWithServer(compiledJson, updatedWeights);
  };

  const handleDeleteCustomRule = async (type, index) => {
    const newJson = JSON.parse(JSON.stringify(compiledJson));
    if (type === "regex") newJson.regex_rules.splice(index, 1);
    else if (type === "ast")
      newJson.ast_rules.dangerous_functions.splice(index, 1);
    setCompiledJson(newJson);
    try {
      const res = await fetch("/api/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: newJson,
          custom_weights: customWeights,
        }),
      });
      if (res.ok) showToast("Custom rule deleted!");
      else showToast("Error", "error");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(defaultRules).map((m) => m.category || "Uncategorized"),
        ),
      ).sort(),
    [defaultRules],
  );

  const filteredCoreRules = useMemo(() => {
    return Object.entries(defaultRules).filter(([key, meta]) => {
      if (
        filterPillar !== "ALL" &&
        (meta.category || "Uncategorized") !== filterPillar
      )
        return false;
      if (severityFilter !== "ALL" && meta.severity !== severityFilter)
        return false;
      const isDisabled = disabledCoreRules.includes(key);
      if (statusFilter === "ON" && isDisabled) return false;
      if (statusFilter === "OFF" && !isDisabled) return false;
      if (searchTerm) {
        const sl = searchTerm.toLowerCase();
        if (
          !key.toLowerCase().includes(sl) &&
          !(meta.reason || "").toLowerCase().includes(sl) &&
          !(meta.category || "").toLowerCase().includes(sl)
        )
          return false;
      }
      return true;
    });
  }, [
    defaultRules,
    filterPillar,
    severityFilter,
    statusFilter,
    searchTerm,
    disabledCoreRules,
  ]);

  const groupedRules = useMemo(() => {
    const groups = {};
    filteredCoreRules.forEach(([key, meta]) => {
      const cat = meta.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push([key, meta]);
    });
    return groups;
  }, [filteredCoreRules]);

  const dbStats = useMemo(() => {
    const total = Object.keys(defaultRules).length;
    const active = total - disabledCoreRules.length;
    let critical = 0;
    Object.values(defaultRules).forEach((v) => {
      if (v.severity === "Blocker" || v.severity === "Critical") critical++;
    });
    const customCount = [
      ...(compiledJson?.regex_rules || []),
      ...(compiledJson?.ast_rules?.dangerous_functions || []),
    ].length;
    return { total, active, critical, customCount };
  }, [defaultRules, disabledCoreRules, compiledJson]);

  const handleBulkToggle = async (category, enable) => {
    const categoryRules = Object.entries(defaultRules)
      .filter(([_, m]) => (m.category || "Uncategorized") === category)
      .map(([k]) => k);
    if (categoryRules.length === 0) return;
    let newDisabled = [...disabledCoreRules];
    for (const r of categoryRules) {
      const isCurrentlyDisabled = disabledCoreRules.includes(r);
      if (enable && isCurrentlyDisabled) {
        handleToggleRule(r, false);
        newDisabled = newDisabled.filter((x) => x !== r);
      } else if (!enable && !isCurrentlyDisabled) {
        handleToggleRule(r, true);
        newDisabled.push(r);
      }
    }
    setDisabledCoreRules(newDisabled);
  };

  const customRuleCount =
    (compiledJson?.regex_rules?.length || 0) +
    (compiledJson?.ast_rules?.dangerous_functions?.length || 0);

  const severityPillOptions = [
    { value: "ALL", label: "All", activeColor: "rgba(255,255,255,0.12)" },
    {
      value: "Blocker",
      label: "Blocker",
      dot: "#ef4444",
      activeColor: "rgba(239,68,68,0.2)",
    },
    {
      value: "Critical",
      label: "Critical",
      dot: "#f97316",
      activeColor: "rgba(249,115,22,0.2)",
    },
    {
      value: "Major",
      label: "Major",
      dot: "#eab308",
      activeColor: "rgba(234,179,8,0.2)",
    },
    {
      value: "Minor",
      label: "Minor",
      dot: "#3b82f6",
      activeColor: "rgba(59,130,246,0.2)",
    },
    {
      value: "Info",
      label: "Info",
      dot: "#64748b",
      activeColor: "rgba(100,116,139,0.2)",
    },
  ];

  const statusPillOptions = [
    { value: "ALL", label: "All", activeColor: "rgba(255,255,255,0.12)" },
    { value: "ON", label: "● ON", activeColor: "rgba(16,185,129,0.2)" },
    { value: "OFF", label: "● OFF", activeColor: "rgba(239,68,68,0.15)" },
  ];

  return (
    <div className="flex-1 flex flex-col w-full bg-transparent pt-0 pb-12 gap-5 font-sans relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 60, x: "-50%" }}
            className={cn(
              "fixed bottom-10 left-1/2 px-5 py-3 rounded-2xl shadow-2xl z-[200] border backdrop-blur-xl flex items-center gap-3",
              toast.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
            )}
          >
            {toast.type === "error" ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full relative z-10 flex flex-col gap-5 max-w-7xl mx-auto">
        {/* ── Project context pill ── */}
        <div className="flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500 font-semibold">
            Configuring:{" "}
            <span className="text-emerald-400 font-black">
              {projectName || targetId || "—"}
            </span>
          </span>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <KpiCard
            icon={ShieldCheck}
            value={dbStats.total}
            label="Total Rules"
            accent="#8b5cf6"
            delay={0}
          />
          <KpiCard
            icon={Zap}
            value={dbStats.active}
            label="Active Rules"
            accent="#10b981"
            delay={0.05}
          />
          <KpiCard
            icon={Flame}
            value={dbStats.critical}
            label="Critical/Blocker"
            accent="#ef4444"
            delay={0.1}
          />
          <KpiCard
            icon={Sparkles}
            value={dbStats.customCount}
            label="Custom AI Rules"
            accent="#f59e0b"
            delay={0.15}
          />
        </div>

        {/* ── Main Panel ── */}
        <div className="bg-[#080c14]/80 backdrop-blur-xl border border-white/[0.07] rounded-2xl flex flex-col flex-1 shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-white/[0.06] shrink-0 bg-black/20">
            {[
              {
                id: "core",
                label: "Core Rules",
                icon: ShieldCheck,
                count: Object.keys(defaultRules).length,
                activeGrad: "from-emerald-600 to-teal-600",
              },
              {
                id: "custom",
                label: "Custom AI Rules",
                icon: Wand2,
                count: customRuleCount,
                activeGrad: "from-violet-600 to-purple-600",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.activeGrad} text-white shadow-md`
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5",
                )}
              >
                <tab.icon size={15} />
                {tab.label}
                <span
                  className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full",
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-slate-500",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filters (Core tab only) */}
          <AnimatePresence>
            {activeTab === "core" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-white/[0.05] shrink-0"
              >
                <div className="p-4 flex flex-col lg:flex-row items-start lg:items-end gap-3 flex-wrap bg-black/10">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Search rule ID, description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-black/40 border border-white/8 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-200 focus:border-emerald-500/50 outline-none placeholder-slate-600 transition-colors"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <PillGroup
                    label="Severity"
                    options={severityPillOptions}
                    value={severityFilter}
                    onChange={setSeverityFilter}
                  />

                  <PillGroup
                    label="Status"
                    options={statusPillOptions}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />

                  {/* Pillar filter — icon pills */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
                      Pillar
                    </span>
                    <div className="flex items-center gap-1 bg-black/30 rounded-xl p-1 border border-white/5 flex-wrap">
                      <button
                        onClick={() => setFilterPillar("ALL")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                          filterPillar === "ALL"
                            ? "bg-white/12 text-white"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        All
                      </button>
                      {availableCategories.map((cat) => {
                        const pm = getPillarMeta(cat);
                        const PIcon = pm.icon;
                        return (
                          <button
                            key={cat}
                            onClick={() => setFilterPillar(cat)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                              filterPillar === cat
                                ? cn("text-white", pm.bg)
                                : "text-slate-500 hover:text-slate-300",
                            )}
                          >
                            <PIcon
                              size={11}
                              className={filterPillar === cat ? pm.color : ""}
                            />
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Custom tab */}
            {activeTab === "custom" && (
              <div>
                {!compiledJson ||
                (!compiledJson.ast_rules?.dangerous_functions?.length &&
                  !compiledJson.regex_rules?.length) ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-20 gap-4 text-slate-600"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/5 border border-violet-500/15 flex items-center justify-center">
                      <Wand2 size={28} className="opacity-40 text-violet-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-500 text-sm">
                        Chưa có Custom Rule
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Dùng{" "}
                        <span className="text-violet-400 font-bold">
                          Rule Builder
                        </span>{" "}
                        để thiết kế luật riêng
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {compiledJson?.regex_rules?.map((r, idx) => (
                      <motion.div
                        key={`regex-${idx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-violet-900/8 border border-violet-500/20 rounded-xl overflow-hidden group hover:border-violet-500/40 transition-all"
                      >
                        <div className="h-[2px] bg-gradient-to-r from-violet-500/60 to-transparent" />
                        <div className="p-4 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-md border border-violet-500/30 uppercase tracking-wider">
                                  REGEX
                                </span>
                                <span className="font-mono font-black text-violet-300 text-sm">
                                  {r.id}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {r.reason}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleDeleteCustomRule("regex", idx)
                              }
                              className="text-slate-600 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <code className="text-[11px] bg-black/50 p-3 rounded-lg text-emerald-400 font-mono break-all border border-white/5">
                            {r.pattern}
                          </code>
                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <span className="text-[9px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 uppercase font-black tracking-wide">
                              Security
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                WEIGHT
                              </span>
                              <WeightInput
                                value={r.weight !== undefined ? r.weight : -2.0}
                                onChange={(val) =>
                                  handleWeightChange(
                                    r.id,
                                    val,
                                    true,
                                    "regex",
                                    idx,
                                  )
                                }
                                isOverride
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {compiledJson?.ast_rules?.dangerous_functions?.map(
                      (df, idx) => (
                        <motion.div
                          key={`ast-${idx}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay:
                              (compiledJson?.regex_rules?.length || 0) * 0.05 +
                              idx * 0.05,
                          }}
                          className="bg-violet-900/8 border border-violet-500/20 rounded-xl overflow-hidden group hover:border-violet-500/40 transition-all"
                        >
                          <div className="h-[2px] bg-gradient-to-r from-amber-500/60 to-transparent" />
                          <div className="p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 uppercase tracking-wider">
                                    AST
                                  </span>
                                  <span className="font-mono font-black text-violet-300 text-sm">
                                    {df.name}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  {df.reason}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  handleDeleteCustomRule("ast", idx)
                                }
                                className="text-slate-600 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <span
                                className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-wide border",
                                  getPillarMeta(df.pillar).bg,
                                  getPillarMeta(df.pillar).color,
                                  getPillarMeta(df.pillar).border,
                                )}
                              >
                                {df.pillar || "Security"}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                  WEIGHT
                                </span>
                                <WeightInput
                                  value={
                                    df.weight !== undefined ? df.weight : -2.0
                                  }
                                  onChange={(val) =>
                                    handleWeightChange(
                                      df.name || df.id,
                                      val,
                                      true,
                                      "ast",
                                      idx,
                                    )
                                  }
                                  isOverride
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Core tab */}
            {activeTab === "core" && Object.keys(groupedRules).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
                <Search size={32} className="opacity-20" />
                <p className="text-sm font-bold text-slate-500">
                  Không tìm thấy rule nào
                </p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterPillar("ALL");
                    setSeverityFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-bold"
                >
                  Xoá bộ lọc
                </button>
              </div>
            )}

            {activeTab === "core" &&
              Object.entries(groupedRules).map(([category, rules], catIdx) => {
                const isExpanded = expandedCategories[category] !== false;
                const pm = getPillarMeta(category);
                const PIcon = pm.icon;
                const activeCount = rules.filter(
                  ([k]) => !disabledCoreRules.includes(k),
                ).length;

                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: catIdx * 0.04 }}
                    className="rounded-2xl border border-white/[0.06] overflow-hidden shadow-lg bg-[#0a0e1a]/60"
                  >
                    {/* Accordion header */}
                    <div
                      className={cn(
                        "flex items-center justify-between px-4 py-3 border-b border-white/[0.04]",
                        isExpanded
                          ? "bg-white/[0.025]"
                          : "hover:bg-white/[0.015] transition-colors",
                      )}
                    >
                      <button
                        onClick={() =>
                          setExpandedCategories((p) => ({
                            ...p,
                            [category]: !p[category],
                          }))
                        }
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight
                            size={16}
                            className={isExpanded ? pm.color : "text-slate-600"}
                          />
                        </motion.div>
                        <div
                          className={cn(
                            "p-1.5 rounded-lg",
                            pm.bg,
                            pm.border,
                            "border",
                          )}
                        >
                          <PIcon size={14} className={pm.color} />
                        </div>
                        <span className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                          {category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[10px] font-black px-2 py-0.5 rounded-full",
                              pm.bg,
                              pm.color,
                            )}
                          >
                            {activeCount}/{rules.length}
                          </span>
                          <span className="text-[10px] text-slate-600">
                            active
                          </span>
                        </div>
                      </button>

                      {/* Bulk toggles */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleBulkToggle(category, true)}
                          title="Enable All"
                          className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                        >
                          <ToggleRight size={16} />
                        </button>
                        <button
                          onClick={() => handleBulkToggle(category, false)}
                          title="Disable All"
                          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-all"
                        >
                          <ToggleLeft size={16} />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.25,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {rules.map(([ruleKey, meta]) => (
                              <RuleCard
                                key={ruleKey}
                                ruleKey={ruleKey}
                                meta={meta}
                                isDisabled={disabledCoreRules.includes(ruleKey)}
                                isCustomWeight={
                                  customWeights[ruleKey] !== undefined
                                }
                                customWeight={customWeights[ruleKey]}
                                onToggle={(isCurrentlyEnabled) =>
                                  handleToggleRule(ruleKey, isCurrentlyEnabled)
                                }
                                onWeightChange={(val) =>
                                  handleWeightChange(ruleKey, val)
                                }
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleManager;
