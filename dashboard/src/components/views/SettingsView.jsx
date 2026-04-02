import React, { useState } from 'react';
import { Settings, AlertTriangle, Zap, Trash2 } from 'lucide-react';

const SettingsView = ({ selectedRepoId, cn }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!selectedRepoId) return;
    
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    
    setConfirmReset(false);
    setIsResetting(true);
    
    try {
      const res = await fetch(`/api/rules?target=${encodeURIComponent(selectedRepoId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert("Thành công: Đã xóa toàn bộ luật Tùy chỉnh và khôi phục Trọng số về Mặc định.");
      } else {
        alert("Có lỗi khi kết nối với máy chủ để reset.");
      }
    } catch (e) {
      alert("Lỗi kết nối mạng.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pt-4 pb-12">
      <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-3">
             <Settings size={28} className="text-violet-400" /> 
             Cài Đặt Hệ Thống
          </h2>
          
          <div className="border rounded-2xl p-6 flex flex-col gap-3 bg-red-900/10 border-red-500/20">
               <h3 className="text-red-400 font-extrabold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> Vùng Nguy Hiểm (Danger Zone)
               </h3>
               <p className="text-slate-400 text-sm mb-4">
                  Khôi phục tất cả quy tắc kiểm toán của dự án <strong className="text-white px-2 py-0.5 bg-black/50 rounded font-mono">{selectedRepoId || "chưa chọn"}</strong> về định dạng tiêu chuẩn ban đầu. Toàn bộ luật được Sinh bởi AI (Custom Rules) và cấu hình điều chỉnh Trọng số (Weight Override) sẽ bị xóa, không thể khôi phục lại.
               </p>
               <button 
                  onClick={handleReset} 
                  disabled={!selectedRepoId || isResetting}
                  className={cn("px-5 py-3 rounded-xl font-bold font-sans transition-all flex items-center justify-center gap-2 max-w-[300px]",
                     !selectedRepoId || isResetting ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500" 
                     : confirmReset ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] animate-pulse" 
                     : "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 hover:border-red-500/50"
                  )}
               >
                  {isResetting ? <Zap className="animate-spin" size={18} /> : <Trash2 size={18} />}
                  {isResetting ? "ĐANG XÓA DỮ LIỆU..." : confirmReset ? "XÁC NHẬN KHÔI PHỤC?" : "KHÔI PHỤC LUẬT MẶC ĐỊNH"}
               </button>
          </div>
      </div>
    </div>
  );
};

export default SettingsView;
