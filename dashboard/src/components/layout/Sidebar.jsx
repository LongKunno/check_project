import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shield, FolderOpen, 
  Activity, ShieldCheck, Wand2, FileSearch, 
  Moon, Sun, Settings 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({
  isSidebarCollapsed, setIsSidebarCollapsed,
  selectedRepoId, setSelectedRepoId,
  configuredRepos,
  aiHealth,
  isLightMode, setIsLightMode,
  cn
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isPathActive = (path) => location.pathname.startsWith(path) || (location.pathname === '/' && path === '/audit');

  return (
      <motion.div 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 280 }}
        className="flex-shrink-0 bg-[#0f172a]/95 backdrop-blur-xl border-r border-white/10 flex flex-col relative z-[100] h-full transition-all duration-300 shadow-2xl"
      >
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3.5 top-8 bg-violet-600 hover:bg-violet-500 rounded-full p-1.5 shadow-lg shadow-violet-500/30 border border-white/10 transition-colors z-50 flex items-center justify-center cursor-pointer"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} className="text-white"/> : <ChevronLeft size={14} className="text-white"/>}
        </button>

        <div className="flex items-center gap-3 p-6 whitespace-nowrap overflow-hidden shrink-0">
          <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-violet-500/20 shrink-0">
             <Shield size={24} className="text-white" />
          </div>
          <AnimatePresence>
            {!isSidebarCollapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="flex flex-col overflow-hidden">
                 <span className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400" style={{fontFamily: 'Outfit'}}>AUDIT ENGINE</span>
                 <span className="text-[9px] uppercase font-bold text-violet-400 tracking-widest bg-violet-500/10 px-1.5 rounded w-fit">Framework V4</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-3 mb-6 shrink-0 mt-2">
           <div className={cn("text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 transition-all", isSidebarCollapsed ? "text-center opacity-70" : "px-3 opacity-70")}>
              {isSidebarCollapsed ? "Dự án" : "Dự án hiện tại"}
           </div>
           
           {!isSidebarCollapsed ? (
             <div className="px-2">
               <select 
                 value={selectedRepoId}
                 onChange={(e) => setSelectedRepoId(e.target.value)}
                 className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-500 text-sm font-semibold shadow-inner cursor-pointer appearance-none"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
               >
                 {configuredRepos.map(repo => (
                   <option key={repo.id} value={repo.id} className="bg-slate-900 text-slate-200">{repo.name}</option>
                 ))}
               </select>
             </div>
           ) : (
             <div 
                className="flex justify-center items-center w-10 aspect-square bg-slate-800/50 rounded-xl border border-slate-700 mx-auto cursor-pointer hover:bg-slate-700 transition-colors"
                title={configuredRepos.find(r => r.id === selectedRepoId)?.name || 'Chọn mục tiêu'}
             >
                <FolderOpen size={18} className="text-violet-400" />
             </div>
           )}
        </div>

        <div className="flex flex-col gap-2 px-3 mt-2 flex-1 overflow-hidden">
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 opacity-70">
              {!isSidebarCollapsed ? "Tính năng chính" : "•••"}
           </div>
           
           <button 
              onClick={() => navigate('/audit')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", isPathActive('/audit') ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="Dashboard Analytics"
           >
              <Activity size={20} className={cn("shrink-0 transition-transform", isPathActive('/audit') ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Dashboard</span>}
           </button>
           
           <button 
              onClick={() => navigate('/rules')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", isPathActive('/rules') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="Rule Manager"
           >
              <ShieldCheck size={20} className={cn("shrink-0 transition-transform", isPathActive('/rules') ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Danh sách Rule</span>}
           </button>
           
           <button 
              onClick={() => navigate('/sandbox')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", isPathActive('/sandbox') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="AI Sandbox"
           >
              <Wand2 size={20} className={cn("shrink-0 transition-transform", isPathActive('/sandbox') ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Tạo Rule AI</span>}
           </button>
           
           <button 
              onClick={() => navigate('/history')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group mt-1", isPathActive('/history') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="Lịch sử Quét"
           >
              <FileSearch size={20} className={cn("shrink-0 transition-transform text-amber-500/80", isPathActive('/history') ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Lịch sử Audit</span>}
           </button>
        </div>
        
        <div className="p-4 border-t border-white/5 mt-auto shrink-0 flex flex-col gap-2">
           <div 
              className={cn("flex items-center p-3 rounded-xl border mb-1", aiHealth.status === 'healthy' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-slate-800/50 border-slate-700 text-slate-400")}
              title="Trạng thái hệ thống AI"
           >
              <div className={cn("w-2 h-2 rounded-full shrink-0", aiHealth.status === 'healthy' ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-500")} />
              {!isSidebarCollapsed && <span className="font-bold text-[11px] uppercase tracking-widest ml-3 whitespace-nowrap">AI {aiHealth.status}</span>}
           </div>

           <button 
              onClick={() => setIsLightMode(!isLightMode)}
              className="flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left text-slate-500 hover:bg-white/5 hover:text-slate-300 overflow-hidden shrink-0 group"
              title="Giao diện Sáng/Tối"
           >
              {isLightMode ? <Moon size={20} className="shrink-0 hover:rotate-12 transition-transform" /> : <Sun size={20} className="shrink-0 hover:rotate-90 transition-transform" />}
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Cài đặt giao diện</span>}
           </button>

           <button 
              onClick={() => navigate('/settings')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", isPathActive('/settings') ? "bg-slate-500/10 text-slate-400 border border-slate-500/20 shadow-inner" : "text-slate-500 hover:bg-white/5 hover:text-slate-300 border border-transparent")}
           >
              <Settings size={20} className={cn("shrink-0 transition-transform", isPathActive('/settings') ? "rotate-45 text-slate-300" : "group-hover:rotate-45")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Cài đặt Cấu hình</span>}
           </button>
        </div>
      </motion.div>
  );
};

export default Sidebar;
