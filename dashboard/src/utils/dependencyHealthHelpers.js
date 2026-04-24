const ISSUE_LABELS = {
  critical_advisory: "critical advisory",
  high_advisory: "high advisory",
  deprecated: "deprecated",
  near_eol: "near EOL",
  eol: "EOL",
  mutable_base_image: "mutable image",
  dynamic_base_image: "dynamic image",
};

const LIFECYCLE_META = {
  active: {
    label: "Active",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  deprecated: {
    label: "Deprecated",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  near_eol: {
    label: "Near EOL",
    classes: "bg-orange-50 text-orange-700 border-orange-200",
  },
  eol: {
    label: "EOL",
    classes: "bg-rose-50 text-rose-700 border-rose-200",
  },
  unknown: {
    label: "Unknown",
    classes: "bg-slate-100 text-slate-500 border-slate-200",
  },
  not_applicable: {
    label: "N/A",
    classes: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export const getDependencyHealthMeta = (status) => {
  if (status === "warning") {
    return {
      label: "Warning",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (status === "pass") {
    return {
      label: "Pass",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  return {
    label: "Unavailable",
    classes: "bg-slate-100 text-slate-500 border-slate-200",
  };
};

export const getDependencyLifecycleMeta = (status) =>
  LIFECYCLE_META[status] || LIFECYCLE_META.unknown;

export const formatDependencyIssueType = (issueType) =>
  ISSUE_LABELS[issueType] || String(issueType || "").replaceAll("_", " ");

export const getDependencyIssueTypes = (item) =>
  [...new Set(item?.issue_types || item?.signals || [])].filter(Boolean);

export const getDependencyIssueSummary = (item) => {
  const issueTypes = getDependencyIssueTypes(item);
  if (issueTypes.length) {
    return issueTypes.map(formatDependencyIssueType).join(" · ");
  }
  if (item?.status === "hygiene") {
    const signals = (item?.signals || []).filter(Boolean);
    if (signals.length) {
      return signals.map(formatDependencyIssueType).join(" · ");
    }
    return "manifest hygiene";
  }
  return "Không có dependency issue rõ ràng";
};

export const getDependencyHealthSummaryLine = (summary, status) => {
  if (!summary) {
    return status === "unavailable"
      ? "Chưa có dependency snapshot"
      : "Không có dữ liệu dependency";
  }

  const parts = [];
  if (summary.critical_advisories) {
    parts.push(`${summary.critical_advisories} critical advisory`);
  }
  if (summary.high_advisories) {
    parts.push(`${summary.high_advisories} high advisory`);
  }
  if (summary.eol_count) {
    parts.push(`${summary.eol_count} EOL`);
  }
  if (summary.near_eol_count) {
    parts.push(`${summary.near_eol_count} near EOL`);
  }
  if (summary.deprecated_count) {
    parts.push(`${summary.deprecated_count} deprecated`);
  }
  if (summary.mutable_base_image_count) {
    parts.push(`${summary.mutable_base_image_count} mutable image`);
  }

  if (parts.length > 0) return parts.join(" · ");
  if (summary.hygiene_warning_count) {
    return `${summary.hygiene_warning_count} hygiene warning`;
  }
  if (summary.unknown_eol_count) {
    return `${summary.unknown_eol_count} unknown lifecycle`;
  }
  if (status === "pass") return "Không phát hiện dependency issue nghiêm trọng";
  return "Chưa đủ dữ liệu manifest hoặc metadata lifecycle";
};
