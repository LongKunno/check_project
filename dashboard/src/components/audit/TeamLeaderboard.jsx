/**
 * TeamLeaderboard — Member/author scores table.
 * Tách từ AuditView.jsx (L512-636, ~125 LOC).
 */
import React from "react";
import { Users } from "lucide-react";
import { getScoreColorClass } from "../../utils/chartHelpers";

const TeamLeaderboard = ({ members }) => {
  if (!members || Object.keys(members).length === 0) return null;

  return (
    <div
      className="glass-card col-span-4"
      style={{
        marginTop: "0.5rem",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        padding: "1.5rem",
        borderRadius: "16px",
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
        <Users size={18} /> TEAM LEADERBOARD
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 4px",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                color: "#94a3b8",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              <th style={{ padding: "0.75rem 0.5rem" }}>Author</th>
              <th style={{ padding: "0.75rem 0.5rem" }}>Total LOC</th>
              <th style={{ padding: "0.75rem 0.5rem" }}>Score</th>
              <th style={{ padding: "0.75rem 0.5rem" }}>Penalty</th>
              <th style={{ padding: "0.75rem 0.5rem" }}>Debt</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(members)
              .sort((a, b) => (b[1]?.final || 0) - (a[1]?.final || 0))
              .map(([author, res]) => {
                const totalPenalty = Object.values(
                  res.punishments || {},
                ).reduce((acc, curr) => acc + curr, 0);
                return (
                  <tr
                    key={author}
                    style={{ background: "rgba(0,0,0,0.02)" }}
                  >
                    <td
                      style={{
                        padding: "0.75rem 0.5rem",
                        fontWeight: 700,
                        color: "#334155",
                        borderRadius: "8px 0 0 8px",
                      }}
                    >
                      {author}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 0.5rem",
                        color: "#94a3b8",
                      }}
                    >
                      {res.loc.toLocaleString()} lines
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 0.5rem",
                        color: getScoreColorClass(res.final / 10),
                        fontWeight: 800,
                        fontSize: "1.1rem",
                      }}
                    >
                      {res.final}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 0.5rem",
                        color: "#ef4444",
                        fontWeight: 700,
                      }}
                    >
                      {Math.abs(totalPenalty).toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 0.5rem",
                        color: "#f59e0b",
                        fontWeight: 700,
                        borderRadius: "0 8px 8px 0",
                      }}
                    >
                      {res.debt_mins}m
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamLeaderboard;
