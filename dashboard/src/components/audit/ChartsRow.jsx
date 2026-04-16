/**
 * ChartsRow — Violation Distribution + Severity Impact charts.
 * Tách từ AuditView.jsx (L636-715, ~80 LOC).
 */
import React from "react";
import { Activity, Shield } from "lucide-react";
import { Doughnut, Bar } from "react-chartjs-2";

const chartCardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
};

const titleStyle = {
  color: "#334155",
  fontWeight: 800,
  fontSize: "0.85rem",
};

const ChartsRow = ({ violationDistData, severityDistData }) => (
  <div className="charts-row">
    <div className="chart-card glass-card" style={chartCardStyle}>
      <h3 className="chart-title" style={titleStyle}>
        <Activity size={18} color="#3b82f6" /> VIOLATION DISTRIBUTION
      </h3>
      <div className="chart-container" style={{ height: "240px" }}>
        {violationDistData && (
          <Doughnut
            data={violationDistData}
            options={{
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "right",
                  labels: {
                    color: "#94a3b8",
                    font: { weight: "600", size: 10 },
                  },
                },
              },
            }}
          />
        )}
      </div>
    </div>
    <div className="chart-card glass-card" style={chartCardStyle}>
      <h3 className="chart-title" style={titleStyle}>
        <Shield size={18} color="#ef4444" /> IMPACT SEVERITY
      </h3>
      <div className="chart-container" style={{ height: "240px" }}>
        {severityDistData && (
          <Bar
            data={severityDistData}
            options={{
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: "rgba(0,0,0,0.05)" },
                  ticks: { color: "#64748b", font: { size: 10 } },
                },
                x: {
                  grid: { display: false },
                  ticks: { color: "#64748b", font: { size: 10 } },
                },
              },
              plugins: { legend: { display: false } },
            }}
          />
        )}
      </div>
    </div>
  </div>
);

export default ChartsRow;
