import React, { useEffect, useState, useMemo } from "react";
import {
  Code2,
  Search,
  Sparkles,
  Wand2,
  ChevronDown,
  FileText,
  Filter,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Pagination from "../ui/Pagination";
import { usePaginationState } from "../../hooks/usePaginationState";

const ITEMS_PER_GROUP = 5;
const GROUPS_PER_PAGE = 8;

const sevColors = {
  Critical: "#ef4444",
  Blocker: "#ef4444",
  Major: "#f59e0b",
  Minor: "#3b82f6",
  Info: "#64748b",
};

const getSev = (v) => {
  if (v.severity) return v.severity;
  const w = Math.abs(v.weight);
  if (w >= 8) return "Critical";
  if (w >= 4) return "Major";
  if (w >= 1) return "Minor";
  return "Info";
};

const ViolationLedger = ({
  violations = [],
  reportView,
  fixingId,
  suggestions,
  fetchFixSuggestion,
}) => {
  const [expandedRules, setExpandedRules] = useState(new Set());
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [severityFilter, setSeverityFilter] = useState("all");
  const [fileSearch, setFileSearch] = useState("");
  const [showAllInGroup, setShowAllInGroup] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(GROUPS_PER_PAGE);

  const severityCounts = useMemo(() => {
    const c = { Critical: 0, Major: 0, Minor: 0, Info: 0 };
    violations.forEach((v) => {
      const s = getSev(v);
      c[s === "Blocker" ? "Critical" : s] =
        (c[s === "Blocker" ? "Critical" : s] || 0) + 1;
    });
    return c;
  }, [violations]);

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (severityFilter !== "all") {
        const s = getSev(v);
        const mapped = s === "Blocker" ? "Critical" : s;
        if (mapped !== severityFilter) return false;
      }
      if (
        fileSearch &&
        !v.file?.toLowerCase().includes(fileSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [violations, severityFilter, fileSearch]);

  const groupedViolations = useMemo(() => {
    const groups = {};
    filteredViolations.forEach((v) => {
      const key = v.rule_id || "OTHER";
      if (!groups[key]) {
        groups[key] = {
          rule_id: key,
          pillar: v.pillar,
          reason: (v.reason || "").split(". AI Note:")[0].split(". AI ")[0],
          violations: [],
          totalWeight: 0,
          worstWeight: 0,
          is_custom: v.is_custom || false,
        };
      }
      groups[key].violations.push(v);
      groups[key].totalWeight += v.weight;
      if (v.weight < groups[key].worstWeight)
        groups[key].worstWeight = v.weight;
    });
    return Object.values(groups).sort((a, b) => a.totalWeight - b.totalWeight);
  }, [filteredViolations]);
  const { pageItems: pagedGroups } = usePaginationState({
    items: groupedViolations,
    currentPage,
    pageSize,
    onPageChange: setCurrentPage,
  });

  const areVisibleGroupsExpanded = pagedGroups.length > 0
    && pagedGroups.every((group) => expandedRules.has(group.rule_id));

  useEffect(() => {
    setCurrentPage(1);
  }, [severityFilter, fileSearch, reportView, violations]);

  const toggleRuleGroup = (ruleId) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const toggleItem = (itemKey) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col w-full h-full overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2 text-slate-800 font-black tracking-widest text-sm uppercase">
          <Code2 size={16} className="text-slate-500" />
          Violation Ledger
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-slate-600">
            {filteredViolations.length}/{violations.length} issues &middot; {groupedViolations.length} rules
          </span>
          {groupedViolations.length > 0 && (
            <button
              onClick={() =>
                areVisibleGroupsExpanded
                  ? setExpandedRules((prev) => {
                    const next = new Set(prev);
                    pagedGroups.forEach((group) => next.delete(group.rule_id));
                    return next;
                  })
                  : setExpandedRules((prev) => {
                    const next = new Set(prev);
                    pagedGroups.forEach((group) => next.add(group.rule_id));
                    return next;
                  })
              }
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg border border-blue-100 transition-colors"
            >
              {areVisibleGroupsExpanded ? "Collapse Page" : "Expand Page"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ FILTER BAR ═══ */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 flex-wrap bg-white">
        {[
          { key: "all", label: "All", count: violations.length, color: "#64748b" },
          { key: "Critical", label: "Critical", count: severityCounts.Critical, color: "#ef4444" },
          { key: "Major", label: "Major", count: severityCounts.Major, color: "#f59e0b" },
          { key: "Minor", label: "Minor", count: severityCounts.Minor, color: "#3b82f6" },
          { key: "Info", label: "Info", count: severityCounts.Info, color: "#94a3b8" },
        ].map((f) => {
          const active = severityFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => {
                setSeverityFilter(f.key);
                setShowAllInGroup(new Set());
                setCurrentPage(1);
              }}
              style={{
                borderColor: active ? `${f.color}40` : "#e2e8f0",
                backgroundColor: active ? `${f.color}15` : "transparent",
                color: active ? f.color : "#64748b",
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors hover:bg-slate-50`}
            >
              {f.label} {f.count > 0 && <span className="opacity-70 ml-1">{f.count}</span>}
            </button>
          );
        })}

        {/* Search */}
        <div className="ml-auto relative flex items-center">
          <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search file..."
            value={fileSearch}
            onChange={(e) => {
              setFileSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-48 focus:w-56"
          />
        </div>
      </div>

      {/* ═══ GROUPED VIOLATIONS LIST ═══ */}
      <div className="overflow-y-auto flex-1 p-4 bg-slate-50/30">
        {groupedViolations.length > 0 ? (
          <div className="flex flex-col gap-3">
            {pagedGroups.map((group) => {
              const isExpanded = expandedRules.has(group.rule_id);
              const sevColor = sevColors[getSev(group.violations[0])] || "#3b82f6";
              const visibleCount = showAllInGroup.has(group.rule_id)
                ? group.violations.length
                : Math.min(ITEMS_PER_GROUP, group.violations.length);
              const hiddenCount = group.violations.length - visibleCount;

              return (
                <div key={group.rule_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  {/* ── Level 0: Group Header ── */}
                  <div
                    onClick={() => toggleRuleGroup(group.rule_id)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ borderLeft: `4px solid ${sevColor}` }}
                  >
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                    />
                    <span className="font-mono font-bold text-sm text-slate-800 flex items-center gap-2">
                      {group.rule_id}
                      {group.is_custom && <Sparkles size={12} className="text-amber-500" />}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest"
                      style={{ background: `${sevColor}15`, color: sevColor }}
                    >
                      {group.violations.length} ISSUES
                    </span>
                    <span className="flex-1" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                      {group.pillar}
                    </span>
                    <span
                      className="font-bold text-sm tracking-tight w-12 text-right"
                      style={{ color: sevColor }}
                    >
                      {group.totalWeight.toFixed(1)}
                    </span>
                  </div>

                  {/* ── Level 1: Compact File Rows ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
                      >
                        {group.violations.slice(0, visibleCount).map((v, i) => {
                          const itemKey = v.id || `${group.rule_id}-${i}`;
                          const isItemOpen = expandedItems.has(itemKey);

                          return (
                            <div key={itemKey} className={`flex flex-col border-b border-slate-100 last:border-b-0`}>
                              {/* File Row */}
                              <div
                                onClick={() => toggleItem(itemKey)}
                                className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-white transition-colors ${isItemOpen ? "bg-white" : ""}`}
                              >
                                <ChevronDown
                                  size={12}
                                  className={`text-slate-400 transition-transform duration-300 ${isItemOpen ? "rotate-0" : "-rotate-90"}`}
                                />
                                <FileText size={14} className="text-blue-500" />
                                <span className="font-mono text-xs font-semibold text-slate-700">
                                  {v.file}
                                  {v.line ? <span className="text-slate-400">:{v.line}</span> : ""}
                                </span>
                                <span className="flex-1" />
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-black"
                                  style={{ background: `${sevColor}15`, color: sevColor }}
                                >
                                  {v.weight}
                                </span>
                              </div>

                              {/* ── Level 2: Expanded Details ── */}
                              <AnimatePresence>
                                {isItemOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                    className="overflow-hidden bg-white border-y border-slate-100"
                                  >
                                    <div className="flex flex-col gap-3 px-10 py-4">
                                      <div className="text-sm font-medium text-slate-600 leading-relaxed">
                                        {v.reason}
                                      </div>

                                      {v.snippet && (
                                        <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-800 overflow-x-auto">
                                          {v.snippet}
                                        </pre>
                                      )}

                                      <div className="flex items-center pt-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            fetchFixSuggestion(v);
                                          }}
                                          disabled={fixingId === v.id}
                                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${fixingId === v.id
                                              ? "bg-amber-100 text-amber-600 border border-amber-200"
                                              : "bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-200"
                                            }`}
                                        >
                                          <Wand2 size={14} />
                                          {fixingId === v.id ? "Thinking..." : suggestions[v.id] ? "Re-generate" : "Fix with AI"}
                                        </button>
                                      </div>

                                      {suggestions[v.id] && (
                                        <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                          <div className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2 flex items-center gap-2">
                                            <Sparkles size={12} /> AI FIX SUGGESTION
                                          </div>
                                          <code className="block bg-white p-3 rounded-lg border border-emerald-100/50 text-xs text-slate-800 whitespace-pre-wrap font-mono leading-relaxed shadow-sm">
                                            {suggestions[v.id]}
                                          </code>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}

                        {/* Show more button */}
                        {hiddenCount > 0 && (
                          <div
                            onClick={() =>
                              setShowAllInGroup((prev) => {
                                const n = new Set(prev);
                                n.add(group.rule_id);
                                return n;
                              })
                            }
                            className="text-center py-2 text-xs font-bold text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors border-t border-slate-100"
                          >
                            Show {hiddenCount} more hidden items
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ EMPTY STATES ═══ */
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            {violations.length === 0 && reportView === "project" ? (
              <>
                <CheckCircle size={48} className="text-emerald-400 opacity-50" />
                <p className="font-medium">All clear! No violations found.</p>
              </>
            ) : reportView === "member" && violations.length === 0 ? (
              <p className="font-medium">Git history is empty. Member report unavailable.</p>
            ) : (
              <>
                <Filter size={48} className="opacity-30" />
                <p className="font-medium">No violations match current filters.</p>
                <button
                  onClick={() => {
                    setSeverityFilter("all");
                    setFileSearch("");
                    setCurrentPage(1);
                  }}
                  className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={groupedViolations.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        showPageSizeSelector={true}
        pageSizeOptions={[5, 8, 12, 20]}
        label="rule groups"
      />
    </div>
  );
};

export default ViolationLedger;
