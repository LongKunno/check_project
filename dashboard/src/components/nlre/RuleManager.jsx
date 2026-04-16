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
  Info,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  X,
  Globe,
  GitCompare,
} from "lucide-react";
import {
  cn,
  getPillarMeta,
  getSeverityMeta,
  PILLAR_META,
  SEVERITY_META,
  WeightInput,
  KpiCard,
  PillGroup,
  ToggleSwitch,
  RuleCard,
  DiffCard,
} from "./RuleManagerParts";


/* ─── Pillar metadata ─────────────────────────────────────────────────── */

/* ─── Main Component ───────────────────────────────────────────────────── */
const RuleManager = ({ targetId, projectName }) => {
  const [defaultRules, setDefaultRules] = useState({});
  const [globalOverrides, setGlobalOverrides] = useState({ disabled_core_rules: [], enabled_core_rules: [], custom_weights: {} });
  const [projectOverrides, setProjectOverrides] = useState({ disabled_core_rules: [], enabled_core_rules: [], custom_weights: {} });
  const [compiledJson, setCompiledJson] = useState(null);
  const [naturalText, setNaturalText] = useState("");
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState("global");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPillar, setFilterPillar] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showTabInfo, setShowTabInfo] = useState(null);
  const weightDebounceRef = useRef(null);
  const pendingWeightsRef = useRef({ global: null, project: null });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRules = async () => {
    if (!targetId) return;
    try {
      const res = await fetch(`/api/rules?target=${encodeURIComponent(targetId)}`);
      const result = await res.json();
      if (result.status === "success" && result.data) {
        setDefaultRules(result.data.default_rules || {});
        setGlobalOverrides(result.data.global_overrides || { disabled_core_rules: [], enabled_core_rules: [], custom_weights: {} });
        setProjectOverrides(result.data.project_rules || { disabled_core_rules: [], enabled_core_rules: [], custom_weights: {} });
        setCompiledJson(result.data.project_rules?.compiled_json || null);
        setNaturalText(result.data.project_rules?.natural_text || "");
      }
    } catch (e) {
      console.error("Fetch rules error", e);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [targetId]);

  const handleToggleRule = async (ruleId, isDisable, reset = false) => {
    const scope = activeTab === "global" ? "GLOBAL" : targetId;
    try {
      const res = await fetch("/api/rules/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: scope,
          rule_id: ruleId,
          is_disabled: isDisable,
          is_override_reset: reset
        }),
      });
      if (res.ok) {
        showToast(`Rule ${ruleId} updated in ${activeTab === "global" ? "GLOBAL" : "PROJECT"}`);
        fetchRules();
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
    } catch (e) { }
  };

  const syncWeightWithServer = async (scope, newWeights) => {
    const target = scope === "GLOBAL" ? "GLOBAL" : targetId;
    try {
      await fetch("/api/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: target,
          natural_text: scope === "GLOBAL" ? "" : naturalText,
          compiled_json: scope === "GLOBAL" ? null : compiledJson,
          custom_weights: newWeights,
        }),
      });
      // KHÔNG gọi fetchRules() ở đây — optimistic update đã đủ
      // fetchRules sẽ ghi đè state trước khi render kịp
    } catch (e) {
      showToast("Lỗi lưu trọng số", "error");
    }
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
      else if (customRuleType === "ast" && updatedJson.ast_rules?.dangerous_functions)
        updatedJson.ast_rules.dangerous_functions[customRuleIdx].weight = val;
      else if (customRuleType === "ai" && Array.isArray(updatedJson.ai_rules))
        updatedJson.ai_rules[customRuleIdx].weight = val;
      setCompiledJson(updatedJson);
      syncStateWithServer(updatedJson, projectOverrides.custom_weights || {});
      return;
    }

    const scope = activeTab === "global" ? "GLOBAL" : "PROJECT";
    const refKey = scope === "GLOBAL" ? "global" : "project";

    const currentWeights = scope === "GLOBAL" ? globalOverrides.custom_weights : projectOverrides.custom_weights;
    const baseWeights = pendingWeightsRef.current[refKey] || currentWeights || {};
    const updatedWeights = { ...baseWeights, [ruleId]: val };

    pendingWeightsRef.current[refKey] = updatedWeights;

    // Optimistic update trước, debounce save sau 600ms
    if (scope === "GLOBAL") setGlobalOverrides(p => ({ ...p, custom_weights: updatedWeights }));
    else setProjectOverrides(p => ({ ...p, custom_weights: updatedWeights }));

    if (weightDebounceRef.current) clearTimeout(weightDebounceRef.current);
    weightDebounceRef.current = setTimeout(() => {
      const weightsToSend = pendingWeightsRef.current[refKey];
      pendingWeightsRef.current[refKey] = null;
      if (weightsToSend) syncWeightWithServer(scope, weightsToSend);
    }, 600);
  };

  const handleDeleteCustomRule = async (type, index) => {
    const newJson = JSON.parse(JSON.stringify(compiledJson));
    if (type === "regex") newJson.regex_rules.splice(index, 1);
    else if (type === "ast") newJson.ast_rules.dangerous_functions.splice(index, 1);
    else if (type === "ai") newJson.ai_rules.splice(index, 1);
    setCompiledJson(newJson);
    try {
      const res = await fetch("/api/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: newJson,
          custom_weights: projectOverrides.custom_weights || {},
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

  // Calculate effective lists based on active tab
  const tabEffectiveDisabled = useMemo(() => {
    if (activeTab === "global") return new Set(globalOverrides.disabled_core_rules || []);
    else if (activeTab === "project") {
      const g_dis = new Set(globalOverrides.disabled_core_rules || []);
      const p_dis = new Set(projectOverrides.disabled_core_rules || []);
      const p_en = new Set(projectOverrides.enabled_core_rules || []);
      const merged = new Set([...g_dis, ...p_dis]);
      for (let rm of p_en) merged.delete(rm);
      return merged;
    }
    return new Set();
  }, [activeTab, globalOverrides, projectOverrides]);

  const tabEffectiveWeights = useMemo(() => {
    if (activeTab === "global") return globalOverrides.custom_weights || {};
    else if (activeTab === "project") {
      return { ...(globalOverrides.custom_weights || {}), ...(projectOverrides.custom_weights || {}) };
    }
    return {};
  }, [activeTab, globalOverrides, projectOverrides]);

  const filteredCoreRules = useMemo(() => {
    return Object.entries(defaultRules).filter(([key, meta]) => {
      if (
        filterPillar !== "ALL" &&
        (meta.category || "Uncategorized") !== filterPillar
      )
        return false;
      if (severityFilter !== "ALL" && meta.severity !== severityFilter)
        return false;
      const isDisabled = tabEffectiveDisabled.has(key);
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
    tabEffectiveDisabled,
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
    const allRuleIds = new Set(Object.keys(defaultRules));

    // activeGlobal: total - (globally disabled rules that actually exist in default rules)
    const gDisabled = (globalOverrides?.disabled_core_rules || []).filter(r => allRuleIds.has(r));
    const activeGlobal = allRuleIds.size - gDisabled.length;

    // activeProject: merge global+project disabled, then subtract project enabled (set operation)
    // This matches backend get_effective_rules() logic: (g_dis ∪ p_dis) - p_en
    const mergedDisabled = new Set([
      ...(globalOverrides?.disabled_core_rules || []),
      ...(projectOverrides?.disabled_core_rules || []),
    ]);
    // Only remove rules that are actually in the merged disabled set (intersection)
    for (const r of (projectOverrides?.enabled_core_rules || [])) {
      mergedDisabled.delete(r);
    }
    // Only count disabled rules that actually exist in default rules
    let effectiveDisabledCount = 0;
    for (const r of mergedDisabled) {
      if (allRuleIds.has(r)) effectiveDisabledCount++;
    }
    const activeProject = allRuleIds.size - effectiveDisabledCount;
    let critical = 0;
    Object.values(defaultRules).forEach((v) => {
      if (v.severity === "Blocker" || v.severity === "Critical") critical++;
    });
    const customCount = [
      ...(compiledJson?.regex_rules || []),
      ...(compiledJson?.ast_rules?.dangerous_functions || []),
      ...(compiledJson?.ai_rules || []),
    ].length;
    return { activeGlobal, activeProject, critical, customCount };
  }, [defaultRules, globalOverrides, projectOverrides, compiledJson]);

  const handleBulkToggle = async (category, enable) => {
    const categoryRules = Object.entries(defaultRules)
      .filter(([_, m]) => (m.category || "Uncategorized") === category)
      .map(([k]) => k);
    if (categoryRules.length === 0) return;

    // Instead of looping individual toggles, optimally just toggle sequentially. For now we loop.
    for (const r of categoryRules) {
      const isCurrentlyDisabled = tabEffectiveDisabled.has(r);
      if (enable && isCurrentlyDisabled) {
        await handleToggleRule(r, false);
      } else if (!enable && !isCurrentlyDisabled) {
        await handleToggleRule(r, true);
      }
    }
  };

  const customRuleCount =
    (compiledJson?.regex_rules?.length || 0) +
    (compiledJson?.ast_rules?.dangerous_functions?.length || 0) +
    (compiledJson?.ai_rules?.length || 0);

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
              "fixed bottom-10 left-1/2 px-5 py-3 rounded-2xl shadow-md z-[200] border flex items-center gap-3",
              toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-emerald-50 border-emerald-200 text-emerald-600",
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
            <span className="text-emerald-600 font-black">
              {projectName || targetId || "—"}
            </span>
          </span>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <KpiCard
            icon={Globe}
            value={dbStats.activeGlobal}
            label="Active Global Rules"
            accent="#3b82f6"
            delay={0}
          />
          <KpiCard
            icon={ShieldCheck}
            value={dbStats.activeProject}
            label="Active Project Rules"
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
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col flex-1 shadow-md overflow-hidden min-h-[500px]">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-slate-200 shrink-0 bg-slate-50 overflow-x-auto scroller-hide">
            {[
              {
                id: "global",
                label: "Global Rules",
                icon: Globe,
                count: Object.keys(defaultRules).length,
                activeGrad: "from-blue-600 to-indigo-600",
                desc: "Chỉnh sửa luật áp dụng chung cho toàn bộ hệ thống. Thay đổi ở đây ảnh hưởng tới tất cả dự án.",
              },
              {
                id: "project",
                label: "Project Overrides",
                icon: ShieldCheck,
                count: Object.keys(defaultRules).length,
                activeGrad: "from-emerald-600 to-teal-600",
                desc: "Ghi đè luật riêng cho dự án hiện tại. Kế thừa Global nhưng cho phép Bật/Tắt hoặc thay đổi trọng số độc lập.",
              },
              {
                id: "custom",
                label: "Custom AI Rules",
                icon: Wand2,
                count: customRuleCount,
                activeGrad: "from-violet-600 to-purple-600",
                desc: "Quản lý các luật tùy chỉnh do AI sinh ra (Regex & AST). Dùng Rule Builder để tạo luật mới.",
              },
              {
                id: "diff",
                label: "Override Manager",
                icon: GitCompare,
                count: Object.keys(projectOverrides?.custom_weights || {}).length + (projectOverrides?.disabled_core_rules || []).length + (projectOverrides?.enabled_core_rules || []).filter(r => (globalOverrides?.disabled_core_rules || []).includes(r)).length,
                activeGrad: "from-orange-600 to-amber-600",
                desc: "Hiển thị tất cả tùy chỉnh Rule (trạng thái, trọng số) của dự án này so với thiết lập Global mặc định.",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.activeGrad} text-white shadow-md`
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                )}
              >
                <tab.icon size={15} />
                {tab.label}
                <span
                  className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full",
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {tab.count}
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); setShowTabInfo(showTabInfo === tab.id ? null : tab.id); }}
                  className={cn("shrink-0 cursor-help transition-colors p-0.5 rounded", activeTab === tab.id ? "text-white/40 hover:text-white/80 hover:bg-white/10" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100")}
                >
                  <Info size={12} />
                </span>
              </button>
            ))}
          </div>

          {/* Filters (Global and Project tabs only) */}
          <AnimatePresence>
            {(activeTab === "global" || activeTab === "project") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-slate-200 shrink-0"
              >
                <div className="p-4 flex flex-col lg:flex-row items-start lg:items-end gap-3 flex-wrap bg-slate-50">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Search rule ID, description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-emerald-500 outline-none placeholder-slate-400 transition-colors"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 flex-wrap">
                      <button
                        onClick={() => setFilterPillar("ALL")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                          filterPillar === "ALL"
                            ? "bg-white/12 text-slate-800"
                            : "text-slate-500 hover:text-slate-700",
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
                                ? cn("text-slate-800", pm.bg)
                                : "text-slate-500 hover:text-slate-700",
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

          {/* Tab Info Bar */}
          <AnimatePresence>
            {showTabInfo && (() => {
              const tabs = {
                global: { icon: Globe, label: "Global Rules", desc: "Chỉnh sửa luật áp dụng chung cho toàn bộ hệ thống. Thay đổi ở đây ảnh hưởng tới tất cả dự án.", color: "blue" },
                project: { icon: ShieldCheck, label: "Project Overrides", desc: "Ghi đè luật riêng cho dự án hiện tại. Kế thừa Global nhưng cho phép Bật/Tắt hoặc thay đổi trọng số độc lập.", color: "emerald" },
                custom: { icon: Wand2, label: "Custom AI Rules", desc: "Quản lý các luật tùy chỉnh do AI sinh ra (Regex & AST). Dùng Rule Builder để tạo luật mới.", color: "violet" },
                diff: { icon: GitCompare, label: "Override Manager", desc: "Hiển thị tất cả tùy chỉnh Rule (trạng thái, trọng số) của dự án này so với thiết lập Global mặc định.", color: "orange" },
              };
              const info = tabs[showTabInfo];
              if (!info) return null;
              const TIcon = info.icon;
              return (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-slate-200"
                >
                  <div className="px-4 py-2.5 flex items-center gap-2.5 bg-slate-50">
                    <TIcon size={13} className={`text-${info.color}-400`} />
                    <span className="text-xs text-slate-600 leading-relaxed">{info.desc}</span>
                    <button onClick={() => setShowTabInfo(null)} className="ml-auto text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Custom tab */}
            {activeTab === "custom" && (
              <div>
                {!compiledJson ||
                  (!compiledJson.ast_rules?.dangerous_functions?.length &&
                    !compiledJson.regex_rules?.length &&
                    !compiledJson.ai_rules?.length) ? (
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
                        className="bg-white border border-violet-200 rounded-xl overflow-hidden group hover:border-violet-300 transition-all"
                      >
                        <div className="h-[2px] bg-gradient-to-r from-violet-500/60 to-transparent" />
                        <div className="p-4 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md border border-violet-200 uppercase tracking-wider">
                                  REGEX
                                </span>
                                <span className="font-mono font-black text-violet-600 text-sm">
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
                          <code className="text-[11px] bg-slate-50 p-3 rounded-lg text-emerald-700 font-mono break-all border border-slate-200">
                            {r.pattern}
                          </code>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200 uppercase font-black tracking-wide">
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
                          className="bg-white border border-violet-200 rounded-xl overflow-hidden group hover:border-violet-300 transition-all"
                        >
                          <div className="h-[2px] bg-gradient-to-r from-amber-500/60 to-transparent" />
                          <div className="p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-wider">
                                    AST
                                  </span>
                                  <span className="font-mono font-black text-violet-600 text-sm">
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
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
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

                    {compiledJson?.ai_rules?.map((ar, idx) => (
                      <motion.div
                        key={`ai-${idx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay:
                            (compiledJson?.regex_rules?.length || 0) * 0.05 +
                            (compiledJson?.ast_rules?.dangerous_functions?.length || 0) * 0.05 +
                            idx * 0.05,
                        }}
                        className="bg-white border border-cyan-200 rounded-xl overflow-hidden group hover:border-cyan-300 transition-all"
                      >
                        <div className="h-[2px] bg-gradient-to-r from-cyan-500/60 to-transparent" />
                        <div className="p-4 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-md border border-cyan-200 uppercase tracking-wider">
                                  AI
                                </span>
                                <span className="font-mono font-black text-cyan-600 text-sm">
                                  {ar.id}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {ar.reason}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleDeleteCustomRule("ai", idx)
                              }
                              className="text-slate-600 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <span className="text-[9px] font-bold text-cyan-600 uppercase tracking-widest block mb-1.5">AI Prompt</span>
                            <p className="text-[11px] text-cyan-700 leading-relaxed italic">
                              {ar.prompt}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span
                              className={cn(
                                "text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-wide border",
                                getPillarMeta(ar.pillar).bg,
                                getPillarMeta(ar.pillar).color,
                                getPillarMeta(ar.pillar).border,
                              )}
                            >
                              {ar.pillar || "Maintainability"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                WEIGHT
                              </span>
                              <WeightInput
                                value={
                                  ar.weight !== undefined ? ar.weight : -2.0
                                }
                                onChange={(val) =>
                                  handleWeightChange(
                                    ar.id,
                                    val,
                                    true,
                                    "ai",
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
                  </div>
                )}
              </div>
            )}

            {/* Global/Project tab */}
            {(activeTab === "global" || activeTab === "project") && Object.keys(groupedRules).length === 0 && (
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

            {(activeTab === "global" || activeTab === "project") &&
              Object.entries(groupedRules).map(([category, rules], catIdx) => {
                const isExpanded = expandedCategories[category] !== false;
                const pm = getPillarMeta(category);
                const PIcon = pm.icon;
                const activeCount = rules.filter(
                  ([k]) => !tabEffectiveDisabled.has(k),
                ).length;

                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: catIdx * 0.04 }}
                    className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white"
                  >
                    {/* Accordion header */}
                    <div
                      className={cn(
                        "flex items-center justify-between px-4 py-3.5 border-b",
                        isExpanded
                          ? ["border-slate-200", pm.bg.replace(/\/\d+/, "/5")]
                          : "border-slate-100 hover:bg-slate-50 transition-colors",
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
                        <span className="font-bold text-sm text-slate-700 uppercase tracking-wider">
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
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <ToggleRight size={16} />
                        </button>
                        <button
                          onClick={() => handleBulkToggle(category, false)}
                          title="Disable All"
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
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
                            {rules.map(([ruleKey, meta]) => {
                              const isOverridden = activeTab === "project" && (
                                projectOverrides?.disabled_core_rules?.includes(ruleKey) ||
                                projectOverrides?.enabled_core_rules?.includes(ruleKey) ||
                                projectOverrides?.custom_weights?.[ruleKey] !== undefined
                              );
                              const isGlobalCustomized = activeTab === "global" && (
                                globalOverrides?.disabled_core_rules?.includes(ruleKey) ||
                                globalOverrides?.custom_weights?.[ruleKey] !== undefined
                              );
                              return (
                                <RuleCard
                                  key={ruleKey}
                                  ruleKey={ruleKey}
                                  meta={meta}
                                  isDisabled={tabEffectiveDisabled.has(ruleKey)}
                                  isCustomWeight={
                                    tabEffectiveWeights[ruleKey] !== undefined
                                  }
                                  customWeight={tabEffectiveWeights[ruleKey]}
                                  onToggle={(shouldDisable) =>
                                    handleToggleRule(ruleKey, shouldDisable, false)
                                  }
                                  onWeightChange={(val) =>
                                    handleWeightChange(ruleKey, val)
                                  }
                                  isOverridden={isOverridden}
                                  onResetOverride={() => handleToggleRule(ruleKey, false, true)}
                                  isGlobalCustomized={isGlobalCustomized}
                                  onResetToDefault={() => handleToggleRule(ruleKey, false, true)}
                                />
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

            {/* Diff/Override Manager Tab */}
            {activeTab === "diff" && (
              <div className="flex flex-col gap-4">

                {(() => { const globalDisabledSet = new Set(globalOverrides?.disabled_core_rules || []); const hasRealOverrides = (projectOverrides?.disabled_core_rules?.length > 0) || (projectOverrides?.enabled_core_rules || []).some(r => globalDisabledSet.has(r)) || Object.keys(projectOverrides?.custom_weights || {}).length > 0; return !hasRealOverrides; })() ? (
                  <div className="py-20 flex flex-col items-center justify-center opacity-60">
                    <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                    <p className="text-emerald-400 font-bold">Dự án hoàn toàn đồng bộ với Global.</p>
                    <p className="text-sm text-slate-500 mt-1">Chưa có ngoại lệ nào được cấu hình cho dự án này.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {(() => {
                      const uniqueOverrides = {};
                      (projectOverrides?.disabled_core_rules || []).forEach(r => {
                        if (!uniqueOverrides[r]) uniqueOverrides[r] = {};
                        uniqueOverrides[r].status = "DISABLED";
                      });
                      const globalDisabledSet = new Set(globalOverrides?.disabled_core_rules || []);
                      (projectOverrides?.enabled_core_rules || []).forEach(r => {
                        // Only show enabled override if it actually overrides a global disable
                        if (globalDisabledSet.has(r)) {
                          if (!uniqueOverrides[r]) uniqueOverrides[r] = {};
                          uniqueOverrides[r].status = "ENABLED";
                        }
                      });
                      Object.entries(projectOverrides?.custom_weights || {}).forEach(([r, w]) => {
                        if (!uniqueOverrides[r]) uniqueOverrides[r] = {};
                        uniqueOverrides[r].weight = w;
                      });
                      return Object.entries(uniqueOverrides).map(([r, overrides]) => (
                        <DiffCard
                          key={`diff-${r}`}
                          ruleId={r}
                          defaultRules={defaultRules}
                          overrides={overrides}
                          onReset={() => handleToggleRule(r, false, true)}
                        />
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RuleManager;
