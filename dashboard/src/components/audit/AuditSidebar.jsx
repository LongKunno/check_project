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
              className="bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5 rounded-xl flex justify-between items-center border border-slate-100"
            >
              <span className="text-sm text-slate-700 font-medium truncate pr-3" title={filename}>
                {filename}
              </span>
              <span className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
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
