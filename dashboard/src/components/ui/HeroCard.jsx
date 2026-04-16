/**
 * HeroCard — Redesigned Project/Member Overview.
 * 2-row layout: Score Ring + Full-width Pillars | 4 KPI mini-cards
 */
import React from "react";
import {
  Activity,
  Code2,
  FolderOpen,
  AlertTriangle,
  Zap,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { getScoreColorClass } from "../../utils/chartHelpers";

const HeroCard = ({
  data,
  reportView,
  selectedMember,
  chartCurrentViolations,
  topImprovements,
}) => {
  const score =
    reportView === "project"
      ? data?.scores?.final
      : data?.scores?.members?.[selectedMember]?.final || 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - Math.min(score / 100, 1));
  const ringColor = getScoreColorClass(score / 10);

  const pillars =
    reportView === "project"
      ? data?.scores?.project_pillars || {}
      : data?.scores?.members?.[selectedMember]?.pillars || {};

  const kpis = [
    {
      label: "Lines of Code",
      value:
        reportView === "project"
          ? data?.metrics?.total_loc?.toLocaleString()
          : (
            data?.scores?.members?.[selectedMember]?.loc || 0
          ).toLocaleString(),
      icon: <Code2 size={16} />,
      accent: "#3b82f6",
      accentLine: "kpi-accent-cyan",
    },
    {
      label: "Features",
      value:
        reportView === "project"
          ? Object.keys(data?.scores?.features || {}).length
          : "-",
      icon: <FolderOpen size={16} />,
      accent: "#8b5cf6",
      accentLine: "kpi-accent-violet",
    },
    {
      label: "Violations",
      value: chartCurrentViolations.length,
      icon: <AlertTriangle size={16} />,
      accent: chartCurrentViolations.length > 100 ? "#ef4444" : "#f59e0b",
      accentLine:
        chartCurrentViolations.length > 100
          ? "kpi-accent-orange"
          : "kpi-accent-amber",
    },
    {
      label: reportView === "project" ? "Weakest Module" : "Tech Debt",
      value:
        reportView === "project"
          ? topImprovements[0]?.name || "-"
          : `${data?.scores?.members?.[selectedMember]?.debt_mins || 0}m`,
      icon: <Zap size={16} />,
      accent: "#f59e0b",
      accentLine: "kpi-accent-amber",
      sub:
        reportView === "project" && topImprovements[0]
          ? `${topImprovements[0].score}/100`
          : undefined,
    },
  ];

  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="glass-card col-span-4"
      style={{
        borderColor:
          reportView === "member"
            ? "rgba(124, 58, 237, 0.2)"
            : "rgba(59, 130, 246, 0.2)",
        background: "#ffffff",
        boxShadow: "0 4px 20px -5px rgba(0,0,0,0.08)",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* ROW 1: Score Ring (left) + Pillars (right) */}
      <div style={{ display: "flex", gap: "3rem", alignItems: "stretch" }}>
        {/* Left: Score + Rating */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
            minWidth: "180px",
            justifyContent: "center",
          }}
        >
          <div
            className="metric-label"
            style={{
              fontSize: "0.8rem",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "1rem",
            }}
          >
            {reportView === "member" ? (
              <>
                <Users size={18} /> {selectedMember}
              </>
            ) : (
              <>
                <Activity size={18} /> OVERVIEW
              </>
            )}
          </div>

          {/* Score Ring */}
          <div
            style={{
              position: "relative",
              width: 150,
              height: 150,
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 100 100" width={150} height={150}>
              <circle cx="50" cy="50" r="45" className="score-ring-track" />
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={ringColor}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  transform: "rotate(-90deg)",
                  transformOrigin: "center",
                  filter: `drop-shadow(0 0 8px ${ringColor}66)`,
                }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  color: ringColor,
                  lineHeight: 1,
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                {score}
              </motion.span>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                /100
              </span>
            </div>
          </div>

          {reportView === "project" && data?.scores?.rating && (
            <div style={{ marginTop: "0.75rem" }}>
              <span
                className="status-badge"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.4rem 1rem",
                  background: "rgba(0,0,0,0.04)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "10px",
                  color: "#334155",
                  fontWeight: 700,
                }}
              >
                {data.scores.rating}
              </span>
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div
          style={{
            width: "1px",
            background: "rgba(0,0,0,0.06)",
            flexShrink: 0,
          }}
        />

        {/* Right: 4 Pillars — full-width horizontal bars */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "1.5rem",
          }}
        >
          {Object.entries(pillars).map(([pillar, pScore], idx) => {
            const color = getScoreColorClass(pScore);
            return (
              <motion.div
                key={pillar}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.08 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#334155",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {pillar}
                  </span>
                  <span
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color,
                      fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    {pScore}
                    <span
                      style={{
                        fontSize: "0.7rem",
                        opacity: 0.4,
                        marginLeft: "2px",
                      }}
                    >
                      /10
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    height: "6px",
                    background: "rgba(0,0,0,0.06)",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pScore * 10}%` }}
                    transition={{
                      duration: 0.8,
                      delay: 0.3 + idx * 0.08,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    style={{
                      height: "100%",
                      background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                      boxShadow: `0 0 12px ${color}44`,
                      borderRadius: "10px",
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ROW 2: KPI Cards strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className={`hero-kpi-card kpi-accent-card ${kpi.accentLine}`}
            style={{
              background: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              transition: "all 0.2s ease",
              cursor: "default",
              overflow: "hidden",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.04)";
              e.currentTarget.style.borderColor = `${kpi.accent}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.02)";
              e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: kpi.accent,
              }}
            >
              {kpi.icon}
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#94a3b8",
                }}
              >
                {kpi.label}
              </span>
            </div>
            <div
              style={{
                fontSize: "1.35rem",
                fontWeight: 900,
                color: "#1e293b",
                fontFamily: "Outfit, sans-serif",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={String(kpi.value)}
            >
              {kpi.value}
            </div>
            {kpi.sub && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: kpi.accent,
                  fontWeight: 700,
                }}
              >
                {kpi.sub}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default HeroCard;
