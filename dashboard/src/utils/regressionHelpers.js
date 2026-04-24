export const getRegressionMeta = (status, summary = null) => {
  if (status === "warning") {
    return {
      label: "Warning",
      classes: "bg-rose-50 text-rose-600 border-rose-200",
    };
  }
  if (status === "pass" && summary?.gate_enabled === false) {
    return {
      label: "Gate Off",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (status === "pass") {
    return {
      label: "Pass",
      classes: "bg-emerald-50 text-emerald-600 border-emerald-200",
    };
  }
  return {
    label: "No Baseline",
    classes: "bg-slate-100 text-slate-500 border-slate-200",
  };
};

export const formatSignedValue = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const numeric = Number(value);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(digits)}`;
};

export const getRegressionSummaryLine = (summary, status) => {
  if (!summary) {
    return status === "unavailable"
      ? "Chưa có baseline để so sánh"
      : "Không có dữ liệu regression";
  }

  const parts = [];
  if (summary.score_delta !== null && summary.score_delta !== undefined) {
    parts.push(`${formatSignedValue(summary.score_delta, 1)} score`);
  }
  if (
    summary.violations_delta !== null &&
    summary.violations_delta !== undefined
  ) {
    const delta = Number(summary.violations_delta);
    const prefix = delta > 0 ? "+" : "";
    parts.push(`${prefix}${delta} issues`);
  }
  if (summary.new_high_severity_count) {
    parts.push(`+${summary.new_high_severity_count} high sev`);
  }

  if (parts.length > 0) return parts.join(" · ");
  if (status === "pass") return "Không có tín hiệu regress";
  return "Chưa đủ dữ liệu để so sánh";
};
