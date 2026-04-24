import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Calendar,
  Layers3,
  MonitorPlay,
  Sparkles,
} from "lucide-react";

const presentations = [
  {
    id: "pres-001",
    number: "01",
    eyebrow: "Foundation Deck",
    title: "Audit Engine — Core Architecture",
    description:
      "Deck nền tảng để chốt baseline kỹ thuật: system topology, 5-step audit pipeline, scoring logic và ranh giới persistence.",
    focus: "Topology / Pipeline / Scoring",
    duration: "12 min",
    status: "Ready",
    date: "2026-04-23",
    url: "/presentations/audit-engine.html",
    gradient: "from-violet-600 via-indigo-500 to-sky-500",
    accentColor: "rgba(124, 58, 237, 0.18)",
    borderColor: "rgba(124, 58, 237, 0.22)",
    tagColor: "text-violet-700 bg-violet-500/10 border-violet-500/20",
    icon: Layers3,
    highlights: [
      "Runtime topology and ownership",
      "5-step audit flow",
      "Scoring normalization",
    ],
  },
  {
    id: "pres-002",
    number: "02",
    eyebrow: "Control Plane Deck",
    title: "NLRE & Rule Manager — Control Plane",
    description:
      "Deck giải thích cách rules được tạo, merge, override và reset mà không làm runtime trở nên mơ hồ hay khó rollback.",
    focus: "Rules / Overrides / Guardrails",
    duration: "14 min",
    status: "Ready",
    date: "2026-04-23",
    url: "/presentations/nlre-rule-manager.html",
    gradient: "from-emerald-600 via-teal-500 to-cyan-400",
    accentColor: "rgba(5, 150, 105, 0.16)",
    borderColor: "rgba(5, 150, 105, 0.22)",
    tagColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
    icon: BrainCircuit,
    highlights: [
      "Three rule families",
      "Global / project override math",
      "Save and reset semantics",
    ],
  },
  {
    id: "pres-003",
    number: "03",
    eyebrow: "Ops Deck",
    title: "AI Ops & Cache — Telemetry Console",
    description:
      "Deck vận hành cho AI telemetry, pricing and budget controls, request traceability và cache policy như một operator surface thật sự.",
    focus: "Telemetry / Budget / Cache",
    duration: "12 min",
    status: "Ready",
    date: "2026-04-23",
    url: "/presentations/ai-ops-cache.html",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    accentColor: "rgba(245, 158, 11, 0.18)",
    borderColor: "rgba(245, 158, 11, 0.24)",
    tagColor: "text-amber-700 bg-amber-500/10 border-amber-500/20",
    icon: Activity,
    highlights: [
      "Cost and request visibility",
      "Pricing / budget enforcement",
      "AI cache operator controls",
    ],
  },
];

const summaryStats = [
  {
    label: "Decks",
    value: "3",
    description: "Một release pack thống nhất thay vì các slide rời rạc.",
  },
  {
    label: "Audience",
    value: "Tech Leads",
    description: "Ưu tiên technical depth nhưng vẫn đủ gọn cho review meeting.",
  },
  {
    label: "Style",
    value: "EN + VI",
    description: "Heading tiếng Anh, narrative tiếng Việt để phù hợp context nội bộ.",
  },
];

const reviewFlow = [
  {
    step: "01",
    title: "Set the baseline",
    description: "Bắt đầu bằng kiến trúc lõi và scoring contract để khóa ngôn ngữ chung.",
  },
  {
    step: "02",
    title: "Inspect the control plane",
    description: "Đi vào rules, overrides, builder flow và guardrails của hệ thống.",
  },
  {
    step: "03",
    title: "Close on operations",
    description: "Kết bằng telemetry, budget, cache và các giới hạn v1 mang tính vận hành.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const formatDeckDate = (value) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const PresentationsStaticView = () => {
  const featuredDeck = presentations[0];
  const FeaturedIcon = featuredDeck.icon;

  return (
    <div className="relative flex-1 overflow-hidden pb-10">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 top-0 h-72 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(241,245,249,0))",
          }}
        />
        <div className="absolute left-[8%] top-10 h-64 w-64 rounded-full bg-rose-200/35 blur-3xl" />
        <div className="absolute right-[8%] top-20 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-violet-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur xl:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-y-0 right-0 w-2/5 opacity-80"
              style={{
                background:
                  "radial-gradient(circle at top, rgba(244,114,182,0.18), transparent 52%), radial-gradient(circle at 75% 55%, rgba(59,130,246,0.14), transparent 38%)",
              }}
            />
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-rose-400/70 via-violet-400/40 to-transparent" />
          </div>

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm">
                <Sparkles size={14} />
                Release Review Pack
              </div>

              <div>
                <h1
                  className="text-4xl font-black tracking-[-0.05em] text-slate-900 lg:text-6xl"
                  style={{ fontFamily: "Outfit, sans-serif" }}
                >
                  MEETING
                  <br />
                  MATERIALS
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 lg:text-base">
                  Không phải một trang link tĩnh. Đây là một release pack được
                  sắp nhịp theo logic buổi review: mở bằng baseline kiến trúc,
                  đi qua rule control plane, rồi chốt ở lớp vận hành AI và cache.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {summaryStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {item.label}
                    </div>
                    <div
                      className="mt-2 text-[28px] font-black tracking-[-0.04em] text-slate-900"
                      style={{ fontFamily: "Outfit, sans-serif" }}
                    >
                      {item.value}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <motion.a
                href={featuredDeck.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25 }}
                className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.55)]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.32),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,0.4),transparent_38%)]" />
                <div className="relative flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                      <MonitorPlay size={13} />
                      Featured Start Point
                    </div>
                    <ArrowUpRight
                      size={18}
                      className="text-white/70 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10 backdrop-blur">
                      <FeaturedIcon size={22} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                        {featuredDeck.eyebrow}
                      </div>
                      <div
                        className="text-2xl font-black tracking-[-0.04em]"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        {featuredDeck.title}
                      </div>
                    </div>
                  </div>

                  <p className="max-w-lg text-sm leading-7 text-white/72">
                    {featuredDeck.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {featuredDeck.highlights.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4 text-sm text-white/68">
                    <span>{featuredDeck.focus}</span>
                    <span className="font-semibold text-white">
                      Open deck →
                    </span>
                  </div>
                </div>
              </motion.a>

              <div className="rounded-[28px] border border-slate-200 bg-white/75 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.2)] backdrop-blur">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700">
                  <MonitorPlay size={12} />
                  Review Order
                </div>
                <div className="space-y-3">
                  {reviewFlow.map((item) => (
                    <div
                      key={item.step}
                      className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        {item.step}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 backdrop-blur">
                <MonitorPlay size={12} />
                Curated Decks
              </div>
              <h2
                className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900 lg:text-4xl"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                Three decks, one review narrative
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-500">
              Mỗi deck có vai trò riêng, visual theme riêng, nhưng cùng chung
              một presentation system để khi mở từng deck, người xem vẫn cảm
              nhận đây là một bộ materials thống nhất.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {presentations.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                  whileHover={{ y: -6 }}
                  className="group relative overflow-hidden rounded-[30px] border bg-white/90 p-6 shadow-[0_20px_56px_-34px_rgba(15,23,42,0.3)] backdrop-blur"
                  style={{
                    borderColor: item.borderColor,
                    boxShadow: `0 24px 56px -36px ${item.accentColor}`,
                  }}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.08] transition-opacity duration-500 group-hover:opacity-[0.12]`}
                  />
                  <div
                    className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${item.gradient} opacity-[0.18] blur-3xl transition duration-700 group-hover:scale-110`}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-90"
                    style={{
                      background:
                        index === 0
                          ? "linear-gradient(90deg, #7c3aed, #0ea5e9)"
                          : index === 1
                            ? "linear-gradient(90deg, #059669, #06b6d4)"
                            : "linear-gradient(90deg, #f59e0b, #f43f5e)",
                    }}
                  />

                  <div className="relative flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {item.eyebrow}
                        </div>
                        <div
                          className="text-6xl font-black leading-none tracking-[-0.08em] text-slate-200"
                          style={{ fontFamily: "Outfit, sans-serif" }}
                        >
                          {item.number}
                        </div>
                      </div>

                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br ${item.gradient} text-white shadow-lg`}
                        style={{ boxShadow: `0 14px 30px -18px ${item.accentColor}` }}
                      >
                        <Icon size={24} />
                      </div>
                    </div>

                    <div>
                      <h3
                        className="text-2xl font-black tracking-[-0.04em] text-slate-900"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${item.tagColor}`}
                      >
                        {item.status}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {item.duration}
                      </span>
                    </div>

                    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Focus
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-700">
                        {item.focus}
                      </div>
                      <div className="mt-4 space-y-2">
                        {item.highlights.map((highlight) => (
                          <div
                            key={highlight}
                            className="flex items-start gap-2 text-sm leading-6 text-slate-500"
                          >
                            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-300" />
                            <span>{highlight}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar size={13} />
                        <span>{formatDeckDate(item.date)}</span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 transition duration-300 group-hover:gap-2">
                        Open deck
                        <ArrowUpRight size={16} />
                      </span>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/72">
              <Sparkles size={12} />
              Design Direction
            </div>
            <h3
              className="mt-4 text-3xl font-black tracking-[-0.05em]"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Less “link list”, more “release narrative”
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/68">
              Meeting materials kiểu mạnh không chỉ nằm ở gradient đẹp. Nó nằm
              ở việc người xem hiểu ngay nên mở deck nào trước, deck nào trả lời
              câu hỏi gì, và tại sao cả bộ lại được tổ chức như một story arc.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.2)] backdrop-blur">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
              <MonitorPlay size={12} />
              What Changed
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-bold text-slate-800">Stronger hierarchy</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Hero, featured deck và release order được tách vai trò rõ ràng.
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-bold text-slate-800">Deck system feel</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ba deck dùng cùng presentation theme nhưng có accent riêng theo chủ đề.
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-bold text-slate-800">Review-ready metadata</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Focus, duration, status và highlights giúp mở deck có chủ đích hơn.
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default PresentationsStaticView;
