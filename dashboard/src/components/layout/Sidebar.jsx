import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shield, FolderOpen, 
  Activity, ShieldCheck, Wand2, FileSearch, 
  Settings, BarChart3, Users, Menu, X
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({
  isSidebarCollapsed, setIsSidebarCollapsed,
  selectedRepoId, setSelectedRepoId,
  configuredRepos,
  aiHealth,
  cn
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isPathActive = (path) => location.pathname.startsWith(path) || (location.pathname === '/' && path === '/project-scores');

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false); // auto-close on mobile
  };

  // Nav items config — MUST use full class strings for Tailwind JIT scanning
  const navItems = [
    { path: '/project-scores', label: 'Project Leaderboard', icon: BarChart3,
      activeClass: 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-inner glow-pink',
      iconClass: 'text-pink-500/80' },
    { path: '/member-scores', label: 'Member Leaderboard', icon: Users,
      activeClass: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner glow-cyan',
      iconClass: 'text-cyan-500/80' },
    { path: '/audit', label: 'Dashboard', icon: Activity,
      activeClass: 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-inner glow-violet',
      iconClass: 'text-violet-500/80' },
    { path: '/rules', label: 'Rule Manager', icon: ShieldCheck,
      activeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner glow-emerald',
      iconClass: 'text-emerald-500/80' },
    { path: '/sandbox', label: 'Rule Builder', icon: Wand2,
      activeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner glow-blue',
      iconClass: 'text-blue-500/80' },
    { path: '/history', label: 'Audit History', icon: FileSearch, mt: true,
      activeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner glow-amber',
      iconClass: 'text-amber-500/80' },
  ];

  const sidebarContent = (
    <>
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
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-3 mb-6 shrink-0 mt-2">
         <div className={cn("text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 transition-all", isSidebarCollapsed ? "text-center opacity-70" : "px-3 opacity-70")}>
            {isSidebarCollapsed ? "Repo" : "Current repository"}
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
              title={configuredRepos.find(r => r.id === selectedRepoId)?.name || 'Select target'}
           >
              <FolderOpen size={18} className="text-violet-400" />
           </div>
         )}
      </div>

      <div className="flex flex-col gap-2 px-3 mt-2 flex-1 overflow-hidden">
         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 opacity-70">
            {!isSidebarCollapsed ? "Main features" : "•••"}
         </div>
         
         {navItems.map(({ path, label, icon: Icon, activeClass, iconClass, mt }) => (
           <button 
              key={path}
              onClick={() => handleNav(path)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group",
                mt && "mt-1",
                isPathActive(path)
                  ? activeClass
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              )}
              title={label}
           >
              <Icon size={20} className={cn("shrink-0 transition-transform", iconClass, isPathActive(path) ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">{label}</span>}
           </button>
         ))}
      </div>
      
      <div className="p-4 border-t border-white/5 mt-auto shrink-0 flex flex-col gap-2">
         <div 
            className={cn("flex items-center p-3 rounded-xl border mb-1", aiHealth.status === 'healthy' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-slate-800/50 border-slate-700 text-slate-400")}
            title="AI System Health"
         >
            <div className={cn("w-2 h-2 rounded-full shrink-0", aiHealth.status === 'healthy' ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-500")} />
            {!isSidebarCollapsed && <span className="font-bold text-[11px] uppercase tracking-widest ml-3 whitespace-nowrap">AI {aiHealth.status}</span>}
         </div>



         <button 
            onClick={() => handleNav('/settings')}
            className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", isPathActive('/settings') ? "bg-slate-500/10 text-slate-400 border border-slate-500/20 shadow-inner" : "text-slate-500 hover:bg-white/5 hover:text-slate-300 border border-transparent")}
         >
            <Settings size={20} className={cn("shrink-0 transition-transform", isPathActive('/settings') ? "rotate-45 text-slate-300" : "group-hover:rotate-45")} />
            {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Settings</span>}
         </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[200] lg:hidden p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/30 border border-white/10 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#0f172a]/98 backdrop-blur-xl border-r border-white/10 flex flex-col z-[200] shadow-2xl lg:hidden overflow-y-auto"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.div 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 280 }}
        className="hidden lg:flex flex-shrink-0 bg-[#0f172a]/95 backdrop-blur-xl border-r border-white/10 flex-col relative z-[100] h-full transition-all duration-300 shadow-2xl"
      >
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3.5 top-8 bg-violet-600 hover:bg-violet-500 rounded-full p-1.5 shadow-lg shadow-violet-500/30 border border-white/10 transition-colors z-50 flex items-center justify-center cursor-pointer"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} className="text-white"/> : <ChevronLeft size={14} className="text-white"/>}
        </button>
        {sidebarContent}
      </motion.div>
    </>
  );
};

export default Sidebar;
