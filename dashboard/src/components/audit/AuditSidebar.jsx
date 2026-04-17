import React from "react";
import { FolderOpen } from "lucide-react";

const AuditSidebar = ({ data, topFiles }) => (
  <div className="flex flex-col gap-5 w-full">
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="text-[10px] font-black uppercase tracking-[3px] text-slate-500 mb-1">
        AUDIT INFO
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Project:</span>
          <span className="font-bold text-slate-800">
            {data?.project_name || "N/A"}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Files scanned:</span>
          <span className="font-bold text-slate-800">{data?.metrics?.total_files || 0} files</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Standard:</span>
          <span className="text-violet-600 font-bold bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
            V3 Stable
          </span>
        </div>
        <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs text-emerald-600 text-center font-medium">
            Results validated via AST syntax tree analysis.
          </p>
        </div>
      </div>
    </div>

    {/* Top Problematic Files */}
    {topFiles?.length > 0 && (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-base font-black text-slate-800">
          <FolderOpen size={18} className="text-amber-500" /> TOP PROBLEMATIC FILES
        </h3>
        <div className="flex flex-col gap-3">
          {topFiles.map(([filename, count], idx) => (
            <div
              key={idx}
              className="bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5 rounded-xl grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-slate-100"
            >
              <div className="relative min-w-0 max-w-full group">
                <span
                  className="block min-w-0 max-w-full truncate text-sm text-slate-700 font-medium cursor-help outline-none"
                  tabIndex={0}
                >
                  {filename}
                </span>
                <span
                  className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-[min(32rem,calc(100vw-4rem))] rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 break-all invisible group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  role="tooltip"
                >
                  {filename}
                </span>
              </div>
              <span className="shrink-0 bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                {count} issues
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default AuditSidebar;
