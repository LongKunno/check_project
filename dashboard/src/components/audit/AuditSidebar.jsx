/**
 * AuditSidebar — Audit info + Top Problematic Files.
 * Tách từ AuditView.jsx (L849-970, ~120 LOC).
 */
import React from "react";
import { FolderOpen } from "lucide-react";

const AuditSidebar = ({ data, topFiles }) => (
  <div className="sidebar">
    <div className="glass-card">
      <div className="metric-label">AUDIT INFO</div>
      <div
        style={{
          fontSize: "0.875rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-muted)" }}>Project:</span>
          <span style={{ fontWeight: 600 }}>
            {data?.project_name || "N/A"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-muted)" }}>Files scanned:</span>
          <span>{data?.metrics?.total_files || 0} files</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-muted)" }}>Standard:</span>
          <span style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
            V3 Stable
          </span>
        </div>
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem",
            background: "rgba(16,185,129,0.05)",
            borderRadius: "8px",
            border: "1px solid rgba(16,185,129,0.1)",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--accent-green)",
              textAlign: "center",
            }}
          >
            Results validated via AST syntax tree analysis.
          </p>
        </div>
      </div>

      {/* Top Problematic Files */}
      {topFiles.length > 0 && (
        <div className="glass-card" style={{ marginTop: "1.5rem" }}>
          <h3
            style={{
              marginBottom: "1.2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: "1rem",
              color: "var(--text-main)",
            }}
          >
            <FolderOpen size={18} color="var(--accent-yellow)" /> TOP
            PROBLEMATIC FILES
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {topFiles.map(([filename, count], idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.85rem",
                    wordBreak: "break-all",
                    paddingRight: "1rem",
                  }}
                >
                  {filename}
                </span>
                <span
                  className="status-badge"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    color: "var(--accent-red)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {count} issues
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default AuditSidebar;
