import React from "react";
import { motion } from "framer-motion";
import { ExternalLink, MonitorPlay, Calendar } from "lucide-react";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 *   PRESENTATIONS STATIC VIEW — Plug-and-Play Module
 *
 *   Hardcoded list of presentation URLs used during meetings.
 *   To add/edit/remove items, modify the `presentations` array below.
 *
 *   🔌 UNINSTALL: Remove this file + 1 route in App.jsx
 *                 + 1 navItem in Sidebar.jsx. That's it.
 * ╚══════════════════════════════════════════════════════════════╝
 */
const presentations = [
  {
    id: "pres-001",
    title: "Audit Engine — System Overview",
    description:
      "Architecture, 5-Step Pipeline, AI Gatekeeper, NLRE Rule Engine, and Hierarchical Scoring Mechanism.",
    date: "2026-04-07",
    url: "/presentations/audit-engine.html",
    gradient: "from-violet-500 to-indigo-400",
    accentColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.25)",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1],
    },
  }),
};

const PresentationsStaticView = () => {
  return (
    <div className="flex-1 flex flex-col w-full pb-8">
      {/* ── Page Header ── */}
      <div className="px-8 pt-8 pb-2 shrink-0 page-header-compact">
        <div className="flex items-center gap-3 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <MonitorPlay size={14} />
            Presentations
          </div>
          <span className="text-slate-600 text-xs font-medium hidden sm:block">
            Important URLs and slides for leadership meetings
          </span>
        </div>
        <h2
          className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-200 to-rose-400"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          MEETING MATERIALS
        </h2>
      </div>

      {/* ── Subtitle strip ── */}
      <div className="px-8 mt-1 mb-6">
        <p className="text-sm text-slate-500 max-w-xl">
          Curated collection of presentation websites prepared for management
          meetings. Click any card to open in a new tab.
        </p>
      </div>

      {/* ── Card Grid ── */}
      <div className="px-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {presentations.map((item, index) => (
          <motion.a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            custom={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="group glass-card flex flex-col cursor-pointer"
            style={{
              borderColor: item.borderColor,
              "--hover-glow": item.accentColor,
            }}
          >
            {/* Accent gradient bar top */}
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${item.gradient} opacity-60 group-hover:opacity-100 transition-opacity`}
            />

            {/* Background glow orb */}
            <div
              className={`absolute -top-8 -right-8 w-40 h-40 bg-gradient-to-br ${item.gradient} opacity-[0.07] rounded-full blur-3xl group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none`}
            />

            {/* Icon + external link */}
            <div className="flex items-start justify-between mb-5 relative z-10">
              <div
                className={`p-3 rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg`}
                style={{ boxShadow: `0 8px 20px -6px ${item.accentColor}` }}
              >
                <MonitorPlay size={22} className="text-white" />
              </div>
              <ExternalLink
                size={18}
                className="text-slate-600 group-hover:text-slate-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-300"
              />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-slate-200 mb-2 relative z-10 group-hover:text-white transition-colors duration-300">
              {item.title}
            </h3>

            {/* Description */}
            <p className="text-[13px] leading-relaxed text-slate-400 relative z-10 flex-1 group-hover:text-slate-300 transition-colors duration-300">
              {item.description}
            </p>

            {/* Footer: Date + CTA */}
            <div className="mt-5 pt-4 border-t border-white/5 relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Calendar size={12} />
                <span>
                  {new Date(item.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${item.tagColor} group-hover:brightness-125 transition-all`}
              >
                Open →
              </span>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
};

export default PresentationsStaticView;
