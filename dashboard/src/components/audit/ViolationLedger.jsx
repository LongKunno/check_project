/**
 * ViolationLedger — Grouped violation list with filters, search, expand/collapse.
 * Tách từ AuditView.jsx (L929-1620, ~700 LOC) để giảm God Object.
 */
import React, { useState, useMemo } from "react";
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

const ITEMS_PER_GROUP = 5;

const sevColors = {
  Critical: "#ef4444",
  Blocker: "#ef4444",
  Major: "#f59e0b",
  Minor: "#3b82f6",
  Info: "#94a3b8",
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
    <div
      className="glass-card"
      style={{ overflow: "hidden", padding: 0 }}
    >
      {/* ═══ HEADER ═══ */}
      <div style={{ padding: "1.25rem 1.5rem 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.85rem",
          }}
        >
          <div
            className="metric-label"
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Code2 size={16} /> VIOLATION LEDGER
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <span
              style={{
                fontSize: "0.68rem",
                color: "#475569",
                fontWeight: 600,
              }}
            >
              {filteredViolations.length}/
              {violations.length} issues ·{" "}
              {groupedViolations.length} rules
            </span>
            {groupedViolations.length > 0 && (
              <button
                onClick={() =>
                  expandedRules.size >= groupedViolations.length
                    ? setExpandedRules(new Set())
                    : setExpandedRules(
                        new Set(
                          groupedViolations.map((g) => g.rule_id),
                        ),
                      )
                }
                style={{
                  background: "rgba(59,130,246,0.06)",
                  color: "#60a5fa",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "6px",
                  fontWeight: 700,
                  border: "1px solid rgba(59,130,246,0.1)",
                  fontSize: "0.62rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {expandedRules.size >= groupedViolations.length
                  ? "Collapse All"
                  : "Expand All"}
              </button>
            )}
          </div>
        </div>

        {/* ═══ FILTER BAR ═══ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            flexWrap: "wrap",
            paddingBottom: "0.85rem",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {[
            { key: "all", label: "All", count: violations.length, color: "#94a3b8" },
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
                }}
                style={{
                  padding: "0.22rem 0.55rem",
                  borderRadius: "6px",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  border: `1px solid ${active ? f.color + "40" : "rgba(255,255,255,0.06)"}`,
                  background: active ? f.color + "15" : "transparent",
                  color: active ? f.color : "#64748b",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f.label}{" "}
                {f.count > 0 && (
                  <span style={{ opacity: 0.7 }}>{f.count}</span>
                )}
              </button>
            );
          })}
          {/* Search */}
          <div
            style={{
              marginLeft: "auto",
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={12}
              style={{
                position: "absolute",
                left: "0.5rem",
                color: "#475569",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search file..."
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px",
                padding: "0.25rem 0.5rem 0.25rem 1.6rem",
                color: "#e2e8f0",
                fontSize: "0.68rem",
                width: "140px",
                outline: "none",
                transition: "all 0.15s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(96,165,250,0.3)";
                e.target.style.width = "180px";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(255,255,255,0.06)";
                if (!e.target.value) e.target.style.width = "140px";
              }}
            />
          </div>
        </div>
      </div>

      {/* ═══ GROUPED VIOLATIONS LIST ═══ */}
      <div
        style={{
          maxHeight: "700px",
          overflowY: "auto",
          padding: "0.5rem 1rem 1rem",
        }}
      >
        {groupedViolations.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {groupedViolations.map((group) => {
              const isExpanded = expandedRules.has(group.rule_id);
              const sevColor =
                sevColors[getSev(group.violations[0])] || "#3b82f6";
              const visibleCount = showAllInGroup.has(group.rule_id)
                ? group.violations.length
                : Math.min(ITEMS_PER_GROUP, group.violations.length);
              const hiddenCount =
                group.violations.length - visibleCount;

              return (
                <div key={group.rule_id}>
                  {/* ── Level 0: Group Header ── */}
                  <div
                    onClick={() => toggleRuleGroup(group.rule_id)}
                    style={{
                      background: isExpanded
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.15)",
                      padding: "0.6rem 0.85rem",
                      borderRadius: isExpanded ? "8px 8px 0 0" : "8px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      borderLeft: `3px solid ${sevColor}`,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                    onMouseEnter={(e) => {
                      if (!isExpanded)
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.025)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isExpanded)
                        e.currentTarget.style.background =
                          "rgba(0,0,0,0.15)";
                    }}
                  >
                    <ChevronDown
                      size={13}
                      style={{
                        color: "#475569",
                        transition: "transform 0.2s",
                        transform: isExpanded
                          ? "rotate(0deg)"
                          : "rotate(-90deg)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontWeight: 800,
                        color: "#e2e8f0",
                        fontSize: "0.75rem",
                        minWidth: 0,
                      }}
                    >
                      {group.rule_id}
                    </span>
                    {group.is_custom && (
                      <Sparkles
                        size={10}
                        style={{ color: "#f59e0b", flexShrink: 0 }}
                      />
                    )}
                    <span
                      style={{
                        background: `${sevColor}15`,
                        color: sevColor,
                        padding: "1px 6px",
                        borderRadius: "5px",
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        flexShrink: 0,
                        lineHeight: "1.4",
                      }}
                    >
                      {group.violations.length}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: "0.58rem",
                        color: "#475569",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      {group.pillar}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: sevColor,
                        fontSize: "0.75rem",
                        fontFamily: "Outfit, sans-serif",
                        minWidth: "2.8rem",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
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
                        transition={{
                          duration: 0.2,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          style={{
                            background: "rgba(0,0,0,0.1)",
                            borderRadius: "0 0 8px 8px",
                            borderLeft: `3px solid ${sevColor}20`,
                          }}
                        >
                          {group.violations
                            .slice(0, visibleCount)
                            .map((v, i) => {
                              const itemKey =
                                v.id || `${group.rule_id}-${i}`;
                              const isItemOpen =
                                expandedItems.has(itemKey);

                              return (
                                <div key={itemKey}>
                                  {/* File Row */}
                                  <div
                                    onClick={() => toggleItem(itemKey)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.4rem",
                                      padding:
                                        "0.45rem 0.85rem 0.45rem 1.1rem",
                                      cursor: "pointer",
                                      transition: "background 0.1s",
                                      borderBottom:
                                        (i < visibleCount - 1 ||
                                          hiddenCount > 0) &&
                                        !isItemOpen
                                          ? "1px solid rgba(255,255,255,0.025)"
                                          : "none",
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.background =
                                        "rgba(255,255,255,0.025)")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.background =
                                        "transparent")
                                    }
                                  >
                                    <ChevronDown
                                      size={10}
                                      style={{
                                        color: "#475569",
                                        transition: "transform 0.15s",
                                        transform: isItemOpen
                                          ? "rotate(0deg)"
                                          : "rotate(-90deg)",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <FileText
                                      size={12}
                                      style={{
                                        color: "#60a5fa",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontFamily:
                                          "JetBrains Mono, monospace",
                                        color: "#cbd5e1",
                                        fontSize: "0.76rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {v.file}
                                      {v.line ? `:${v.line}` : ""}
                                    </span>
                                    <span style={{ flex: 1 }} />
                                    <span
                                      style={{
                                        background: `${sevColor}12`,
                                        color: sevColor,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        fontSize: "0.62rem",
                                        fontWeight: 800,
                                        fontFamily:
                                          "Outfit, sans-serif",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {v.weight}
                                    </span>
                                  </div>

                                  {/* ── Level 2: Expanded Details ── */}
                                  <AnimatePresence>
                                    {isItemOpen && (
                                      <motion.div
                                        initial={{
                                          height: 0,
                                          opacity: 0,
                                        }}
                                        animate={{
                                          height: "auto",
                                          opacity: 1,
                                        }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        <div
                                          style={{
                                            padding:
                                              "0.5rem 0.85rem 0.65rem 2.1rem",
                                            background:
                                              "rgba(0,0,0,0.12)",
                                            borderBottom:
                                              "1px solid rgba(255,255,255,0.025)",
                                          }}
                                        >
                                          {/* Reason */}
                                          <div
                                            style={{
                                              color: "#94a3b8",
                                              fontSize: "0.73rem",
                                              lineHeight: 1.55,
                                              marginBottom: v.snippet
                                                ? "0.5rem"
                                                : 0,
                                            }}
                                          >
                                            {v.reason}
                                          </div>
                                          {/* Snippet */}
                                          {v.snippet && (
                                            <pre
                                              style={{
                                                padding:
                                                  "0.6rem 0.75rem",
                                                background:
                                                  "rgba(0,0,0,0.35)",
                                                borderRadius: "6px",
                                                overflow: "auto",
                                                maxHeight: "200px",
                                                fontSize: "0.72rem",
                                                color: "#bae6fd",
                                                fontFamily:
                                                  "JetBrains Mono, monospace",
                                                lineHeight: 1.6,
                                                border:
                                                  "1px solid rgba(255,255,255,0.04)",
                                                margin: 0,
                                              }}
                                            >
                                              {v.snippet}
                                            </pre>
                                          )}
                                          {/* AI Fix button */}
                                          <div
                                            style={{
                                              marginTop: "0.45rem",
                                              display: "flex",
                                              gap: "0.5rem",
                                            }}
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                fetchFixSuggestion(v);
                                              }}
                                              disabled={
                                                fixingId === v.id
                                              }
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding:
                                                  "0.2rem 0.5rem",
                                                borderRadius: "5px",
                                                fontSize: "0.65rem",
                                                fontWeight: 700,
                                                background:
                                                  fixingId === v.id
                                                    ? "rgba(245,158,11,0.12)"
                                                    : "rgba(139,92,246,0.08)",
                                                color:
                                                  fixingId === v.id
                                                    ? "#f59e0b"
                                                    : "#a78bfa",
                                                border: `1px solid ${fixingId === v.id ? "rgba(245,158,11,0.2)" : "rgba(139,92,246,0.15)"}`,
                                                cursor: "pointer",
                                                transition:
                                                  "all 0.15s",
                                              }}
                                            >
                                              <Wand2 size={11} />
                                              {fixingId === v.id
                                                ? "Thinking..."
                                                : suggestions[v.id]
                                                  ? "Re-generate"
                                                  : "Fix with AI"}
                                            </button>
                                          </div>

                                          {/* AI Fix Suggestion */}
                                          {suggestions[v.id] && (
                                            <div
                                              style={{
                                                marginTop: "0.45rem",
                                                background:
                                                  "rgba(16,185,129,0.04)",
                                                border:
                                                  "1px solid rgba(16,185,129,0.1)",
                                                borderRadius: "6px",
                                                padding: "0.6rem",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  color: "#10b981",
                                                  fontWeight: 700,
                                                  fontSize: "0.6rem",
                                                  marginBottom:
                                                    "0.3rem",
                                                  textTransform:
                                                    "uppercase",
                                                  letterSpacing:
                                                    "0.05em",
                                                }}
                                              >
                                                AI FIX SUGGESTION
                                              </div>
                                              <code
                                                style={{
                                                  background:
                                                    "rgba(0,0,0,0.3)",
                                                  padding: "0.5rem",
                                                  borderRadius: "5px",
                                                  display: "block",
                                                  color: "#bae6fd",
                                                  fontSize: "0.72rem",
                                                  whiteSpace:
                                                    "pre-wrap",
                                                  lineHeight: 1.5,
                                                }}
                                              >
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
                              style={{
                                padding: "0.4rem 1rem",
                                textAlign: "center",
                                fontSize: "0.68rem",
                                color: "#60a5fa",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "background 0.1s",
                                borderTop:
                                  "1px dashed rgba(96,165,250,0.15)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "rgba(96,165,250,0.04)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              Show {hiddenCount} more
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ EMPTY STATES ═══ */
          <div
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              padding: "3rem 0",
            }}
          >
            {violations.length === 0 &&
            reportView === "project" ? (
              <>
                <CheckCircle
                  size={44}
                  style={{
                    marginBottom: "0.75rem",
                    color: "var(--accent-green)",
                    opacity: 0.5,
                  }}
                />
                <p style={{ fontSize: "0.85rem" }}>
                  All clear! No violations found.
                </p>
              </>
            ) : reportView === "member" &&
              violations.length === 0 ? (
              <p style={{ fontSize: "0.85rem" }}>
                Git history is empty. Member report unavailable.
              </p>
            ) : (
              <>
                <Filter
                  size={36}
                  style={{ marginBottom: "0.75rem", opacity: 0.3 }}
                />
                <p style={{ fontSize: "0.85rem" }}>
                  No violations match current filters.
                </p>
                <button
                  onClick={() => {
                    setSeverityFilter("all");
                    setFileSearch("");
                  }}
                  style={{
                    marginTop: "0.5rem",
                    background: "rgba(59,130,246,0.08)",
                    color: "#60a5fa",
                    padding: "0.3rem 0.8rem",
                    borderRadius: "6px",
                    fontWeight: 600,
                    border: "1px solid rgba(59,130,246,0.12)",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViolationLedger;
