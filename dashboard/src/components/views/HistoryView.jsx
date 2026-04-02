import React, { useState, useEffect } from 'react';
import { FileSearch, Zap, FolderOpen, Activity } from 'lucide-react';
import { getScoreColorClass } from '../../utils/chartHelpers';

const HistoryView = ({ selectedRepoId, targetUrl, onRestoreAudit, cn }) => {
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    // Nếu targetUrl chưa có (local project) thì fall back qua selectedRepoId tạm thời, ưu tiên URL
    const fetchTarget = targetUrl || selectedRepoId;
    if (!fetchTarget) return;

    setIsLoading(true);
    fetch(`/api/history?target=${encodeURIComponent(fetchTarget)}`)
      .then(r => r.json())
      .then(data => {
        setHistoryList(data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [targetUrl, selectedRepoId]);

  const handleRestore = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/history/${id}`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.full_json) {
          onRestoreAudit(detail.full_json);
        } else {
          alert('Báo cáo lịch sử không chứa dữ liệu chi tiết JSON (Lỗi cấu trúc hoặc bản cũ).');
        }
      } else {
        alert('Lỗi khi lấy chi tiết lịch sử từ Backend.');
      }
    } catch (e) {
      alert('Lỗi kết nối mạng khi tải chi tiết lịch sử.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pt-4 pb-12 px-6">
      <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
            <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-amber-500/20 rounded-xl shadow-inner shadow-amber-500/20 border border-amber-500/30">
                 <FileSearch size={22} className="text-amber-400" />
              </div>
              LỊCH SỬ KIỂM TOÁN
            </h2>
            <div className="px-4 py-1.5 bg-slate-800 rounded-lg border border-slate-700 font-mono text-sm text-slate-300">
               {selectedRepoId || "CHƯA CHỌN DỰ ÁN"}
            </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20 text-slate-400 gap-3 font-semibold">
              <Zap className="animate-spin text-amber-500" size={20} /> ĐANG ĐỒNG BỘ DỮ LIỆU...
          </div>
        ) : historyList.length === 0 ? (
          <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-20" />
            <div className="font-bold text-lg mb-1">Chưa có dữ liệu lịch sử</div>
            <div className="text-sm">Hãy chạy phân tích dự án này ít nhất một lần để xem lịch sử.</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/40 shadow-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-slate-400 text-[11px] uppercase tracking-widest border-b border-white/5">
                  <th className="p-4 font-bold">Thời gian quét</th>
                  <th className="p-4 font-bold">Xếp hạng</th>
                  <th className="p-4 font-bold">Điểm số</th>
                  <th className="p-4 font-bold">Quy mô (LOC)</th>
                  <th className="p-4 font-bold text-center">Vi phạm</th>
                  <th className="p-4 font-bold text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {historyList.map(h => {
                   const colorClass = getScoreColorClass(h.score / 10);
                   return (
                  <tr key={h.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-slate-300 font-mono text-sm flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: colorClass, color: colorClass }}></span>
                       {new Date(h.timestamp + "Z").toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-white/5 border-white/10 border text-white rounded-md text-[11px] font-bold shadow-sm inline-flex">
                        {h.rating}
                      </span>
                    </td>
                    <td className="p-4 font-black" style={{ color: colorClass, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>
                       {h.score}
                    </td>
                    <td className="p-4 text-slate-400 text-sm font-semibold">{h.total_loc?.toLocaleString()} lines</td>
                    <td className="p-4 text-center">
                       <span className="text-amber-500/90 font-bold bg-amber-500/10 px-2 py-1 rounded text-xs border border-amber-500/20">{h.violations_count} Lỗi</span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleRestore(h.id)}
                        disabled={loadingId === h.id}
                        className={cn("mx-auto px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all flex items-center justify-center gap-2",
                          loadingId === h.id 
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                            : "bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 shadow-lg shadow-transparent hover:shadow-blue-500/20 hover:-translate-y-0.5"
                        )}
                        title="Tái hiện lại Dashboard của bản ghi này"
                      >
                        {loadingId === h.id ? <Zap className="animate-spin" size={14} /> : <Activity size={14} className="group-hover:scale-110 transition-transform" />}
                        {loadingId === h.id ? "ĐANG TẢI..." : "XEM LẠI"}
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
