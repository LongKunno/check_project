import React from "react";

export const numberFmt = new Intl.NumberFormat("en-US");
export const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const FIELD_LABELS = {
  items: "Pricing Rows",
  daily_budget_usd: "Daily Budget (USD)",
  monthly_budget_usd: "Monthly Budget (USD)",
  retention_days: "Retention Days",
  hard_stop_enabled: "Hard Stop",
  raw_payload_retention_enabled: "Raw Payload Retention",
};

const HUMANIZED_TOKEN_OVERRIDES = {
  ai: "AI",
  api: "API",
  id: "ID",
  n: "N/A",
  na: "N/A",
  openai: "OpenAI",
  sha256: "SHA256",
  usd: "USD",
};

export const readJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const hasVietnameseText = (value) =>
  /[À-ỹ]/i.test(value) ||
  /\b(không|vui lòng|lỗi|ngân sách|không thể|đã|chưa|yêu cầu|chi tiết)\b/i.test(
    value,
  );

export const humanizeValue = (value) =>
  String(value || "")
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (HUMANIZED_TOKEN_OVERRIDES[lower]) {
        return HUMANIZED_TOKEN_OVERRIDES[lower];
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

const formatValidationDetail = (item) => {
  if (!item || typeof item !== "object") return "";
  const fieldKey = Array.isArray(item.loc)
    ? String(item.loc[item.loc.length - 1] || "")
    : "";
  const fieldLabel = FIELD_LABELS[fieldKey] || humanizeValue(fieldKey) || "Field";
  const message = String(item.msg || "").trim();
  const lowered = message.toLowerCase();
  const numericMatch = message.match(/-?\d+(?:\.\d+)?/);

  if (lowered.includes("greater than or equal to")) {
    return `${fieldLabel} phải lớn hơn hoặc bằng ${numericMatch?.[0] || "giá trị tối thiểu"}.`;
  }
  if (lowered.includes("less than or equal to")) {
    return `${fieldLabel} phải nhỏ hơn hoặc bằng ${numericMatch?.[0] || "giá trị tối đa"}.`;
  }
  if (lowered.includes("valid number")) {
    return `${fieldLabel} phải là số hợp lệ.`;
  }
  if (lowered.includes("valid boolean")) {
    return `${fieldLabel} phải là giá trị bật/tắt hợp lệ.`;
  }
  if (lowered.includes("field required")) {
    return `${fieldLabel} là trường bắt buộc.`;
  }
  return message ? `${fieldLabel}: ${message}` : "";
};

const normalizeApiDetail = (detail) => {
  if (!detail) return "";
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "string" ? item.trim() : formatValidationDetail(item),
      )
      .filter(Boolean)
      .join(" ");
  }
  if (typeof detail === "object") {
    return normalizeApiDetail(detail.detail || detail.message || detail.error || "");
  }
  return String(detail);
};

export const localizeAiOpsMessage = (detail, fallback) => {
  const message = normalizeApiDetail(detail);
  if (!message) return fallback;
  if (hasVietnameseText(message)) return message;

  const lowered = message.toLowerCase();
  if (lowered.includes("failed to load ai overview")) {
    return "Không thể tải phần tổng quan AI Ops.";
  }
  if (lowered.includes("failed to load ai settings")) {
    return "Không thể tải cấu hình pricing, budget và cache của AI Ops.";
  }
  if (lowered.includes("failed to load ai requests")) {
    return "Không thể tải danh sách request AI.";
  }
  if (lowered.includes("failed to load request detail")) {
    return "Không thể tải chi tiết request AI đã chọn.";
  }
  if (lowered.includes("failed to save pricing")) {
    return "Không thể lưu bảng giá AI.";
  }
  if (lowered.includes("failed to save budget")) {
    return "Không thể lưu chính sách ngân sách AI.";
  }
  if (lowered.includes("failed to save cache")) {
    return "Không thể lưu chính sách cache AI.";
  }
  if (lowered.includes("failed to clear cache")) {
    return "Không thể xoá cache AI lúc này.";
  }
  if (lowered.includes("pricing research")) {
    return "Không thể research giá từ nguồn chính thức lúc này.";
  }
  if (lowered.includes("pricing source connection error")) {
    return "Không thể kết nối tới nguồn giá chính thức.";
  }
  if (lowered.includes("pricing source http")) {
    return "Nguồn giá chính thức đang trả về lỗi và chưa thể dùng để research.";
  }
  if (lowered.includes("supports openai, anthropic, and google")) {
    return "Research giá hiện chỉ hỗ trợ OpenAI, Anthropic và Google.";
  }
  if (lowered.includes("requires a non-empty model")) {
    return "Vui lòng chọn model trước khi research giá.";
  }
  if (lowered.includes("no official pricing match found")) {
    return "Không tìm thấy model tương ứng trên nguồn giá chính thức.";
  }
  if (
    lowered.includes("pricing rows must include non-empty provider, mode, and model")
  ) {
    return "Mỗi dòng pricing phải có đủ provider, mode và model.";
  }
  if (lowered.includes("budget exceeded") || lowered.includes("hard stop")) {
    return "Request bị chặn vì ngân sách AI đã vượt ngưỡng hard stop đã cấu hình.";
  }
  if (lowered.includes("network error") || lowered.includes("connection error")) {
    return "Không thể kết nối tới dịch vụ AI Ops.";
  }
  if (lowered.includes("not found")) {
    return "Không tìm thấy dữ liệu AI được yêu cầu.";
  }
  return fallback;
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const toExclusiveDate = (value) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString().slice(0, 10);
};

export const formatPercent = (value) =>
  `${((Number(value) || 0) * 100).toFixed(1)}%`;

export const createEmptyCacheStageSummary = () => ({
  hits: 0,
  misses: 0,
  writes: 0,
  saved_input_tokens: 0,
  saved_output_tokens: 0,
  saved_cost_usd: 0,
});

export const createEmptyCacheSummary = () => ({
  hits: 0,
  misses: 0,
  writes: 0,
  hit_rate: 0,
  saved_input_tokens: 0,
  saved_output_tokens: 0,
  saved_cost_usd: 0,
  by_stage: {
    validation: createEmptyCacheStageSummary(),
    deep_audit: createEmptyCacheStageSummary(),
    cross_check: createEmptyCacheStageSummary(),
  },
});

export const createEmptyCacheState = () => ({
  enabled: true,
  validation_enabled: true,
  deep_audit_enabled: true,
  cross_check_enabled: true,
  retention_days: 30,
  last_cleanup_at: "",
  last_hit_at: "",
  entries_count: 0,
  all_time_summary: createEmptyCacheSummary(),
});

export const normalizeCacheState = (payload = {}) => {
  const base = createEmptyCacheState();
  const summary = {
    ...createEmptyCacheSummary(),
    ...(payload.all_time_summary || {}),
    by_stage: {
      ...createEmptyCacheSummary().by_stage,
      ...((payload.all_time_summary || {}).by_stage || {}),
    },
  };

  return {
    ...base,
    ...payload,
    retention_days: Number(payload.retention_days || base.retention_days),
    entries_count: Number(payload.entries_count || 0),
    all_time_summary: summary,
  };
};

export const chartOptions = {
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#475569",
        font: { size: 11, weight: "600" },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#64748b", font: { size: 11 } },
    },
    y: {
      grid: { color: "rgba(148,163,184,0.18)" },
      ticks: { color: "#64748b", font: { size: 11 } },
    },
  },
};

export const StatsCard = ({ icon, label, value, hint, tone = "slate" }) => (
  <div
    className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm transition-all ${
      tone === "violet"
        ? "border-violet-200/70"
        : tone === "emerald"
          ? "border-emerald-200/70"
          : tone === "amber"
            ? "border-amber-200/70"
            : tone === "rose"
              ? "border-rose-200/70"
              : "border-slate-200"
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
        {icon}
      </div>
    </div>
    <div className="mt-3 break-words text-2xl font-black tracking-tight text-slate-800">
      {value}
    </div>
    <div className="mt-1 break-words text-xs leading-relaxed text-slate-500">{hint}</div>
  </div>
);

export const SectionTitle = ({ icon, title, description }) => (
  <div className="mb-4 flex min-w-0 items-start gap-3">
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm">
      {icon}
    </div>
    <div className="min-w-0">
      <h3 className="text-sm font-black tracking-tight text-slate-800">{title}</h3>
      {description ? (
        <p className="break-words text-xs leading-relaxed text-slate-500">{description}</p>
      ) : null}
    </div>
  </div>
);

export const FieldShell = ({ label, icon, children, className = "" }) => (
  <div
    className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm ${className}`}
  >
    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
      {icon}
      {label}
    </div>
    {children}
  </div>
);
