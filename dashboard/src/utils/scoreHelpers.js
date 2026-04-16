/**
 * scoreHelpers.js — Shared utility functions for score display
 * 
 * Extracted from ProjectScoresView & MemberScoresView to remove
 * duplication (~60 lines duplicated across both files).
 */

// ─── Rating Badge Color ──────────────────────────────────────────────────────

export const getRatingColor = (rating) => {
    if (!rating) return "bg-slate-100 text-slate-500 border-slate-200";
    const r = rating.toLowerCase();
    if (r.includes("excellent") || r.includes("xuất sắc"))
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (r.includes("good") || r.includes("tốt"))
        return "bg-blue-50 text-blue-600 border-blue-200";
    if (r.includes("fair") || r.includes("khá"))
        return "bg-amber-50 text-amber-600 border-amber-200";
    if (r.includes("average") || r.includes("trung"))
        return "bg-orange-50 text-orange-600 border-orange-200";
    return "bg-rose-50 text-rose-600 border-rose-200";
};

// ─── Score Text Color ────────────────────────────────────────────────────────

export const getScoreColor = (score) => {
    if (score == null) return "text-slate-500";
    if (score >= 90) return "text-emerald-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 65) return "text-amber-600";
    if (score >= 45) return "text-orange-600";
    return "text-rose-600";
};

// ─── Score Dot Indicator ─────────────────────────────────────────────────────

export const getScoreDotClass = (score) => {
    if (score == null) return "";
    if (score >= 90) return "score-dot score-dot-emerald";
    if (score >= 80) return "score-dot score-dot-blue";
    if (score >= 65) return "score-dot score-dot-amber";
    if (score >= 45) return "score-dot score-dot-orange";
    return "score-dot score-dot-rose";
};

// ─── Score Gradient (for large score displays) ───────────────────────────────

export const getScoreGradient = (score) => {
    if (score == null) return "from-slate-600 to-slate-800";
    if (score >= 90) return "from-emerald-400 to-teal-500";
    if (score >= 80) return "from-blue-400 to-indigo-500";
    if (score >= 65) return "from-amber-400 to-orange-500";
    return "from-rose-400 to-red-600";
};
