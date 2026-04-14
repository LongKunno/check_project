/**
 * RuleBreakdownTable — Rule violation breakdown table.
 * Tách từ AuditView.jsx (L717-836, ~120 LOC).
 */
import React from "react";
import { ShieldCheck } from "lucide-react";

const RuleBreakdownTable = ({ ruleBreakdown }) => {
  if (!ruleBreakdown || ruleBreakdown.length === 0) return null;

  return (
    <div
      className="glass-card mb-6"
      style={{
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="metric-label"
        style={{
          color: "#10b981",
          fontWeight: 800,
          fontSize: "0.9rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          textTransform: "uppercase",
        }}
      >
        <ShieldCheck size={18} /> RULE BREAKDOWN
      </div>
      <div
        style={{
          overflowX: "auto",
          maxHeight: "350px",
          overflowY: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 4px",
            textAlign: "left",
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              background: "rgba(15,23,42,0.9)",
              zIndex: 10,
            }}
          >
            <tr
              style={{
                color: "#94a3b8",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              <th style={{ padding: "0.75rem 0.5rem" }}>Rule ID</th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                Count
              </th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                Total Penalty
              </th>
            </tr>
          </thead>
          <tbody>
            {ruleBreakdown.map((rule, idx) => (
              <tr
                key={idx}
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <td
                  style={{
                    padding: "0.75rem 0.5rem",
                    fontWeight: 700,
                    color: "#f8fafc",
                    borderRadius: "8px 0 0 8px",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  }}
                >
                  {rule.id}
                </td>
                <td
                  style={{
                    padding: "0.75rem 0.5rem",
                    color: "#f59e0b",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {rule.count}
                </td>
                <td
                  style={{
                    padding: "0.75rem 0.5rem",
                    color: "#ef4444",
                    fontWeight: 800,
                    textAlign: "center",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  {Math.abs(rule.weight).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RuleBreakdownTable;
