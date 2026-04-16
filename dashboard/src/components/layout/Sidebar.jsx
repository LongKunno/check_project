import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  FolderOpen,
  Activity,
  ShieldCheck,
  Wand2,
  FileSearch,
  Settings,
  BarChart3,
  Users,
  Menu,
  X,
  MonitorPlay,
  Globe,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export const Sidebar = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  selectedRepoId,
  setSelectedRepoId,
  configuredRepos,
  aiHealth,
  cn,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout, isAnonymous } = useAuth();

  const isPathActive = (path) =>
    location.pathname.startsWith(path) ||
    (location.pathname === "/" && path === "/project-scores");

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  // --- GLOBAL VIEWS: Không phụ thuộc Current Repository ---
  const globalNavItems = [
    {
      path: "/project-scores",
      label: "Project Leaderboard",
      icon: BarChart3,
      activeClass:
        "bg-pink-500/15 text-pink-300 border border-pink-500/25",
      iconClass: "text-pink-400",
    },
    {
      path: "/member-scores",
      label: "Member Leaderboard",
      icon: Users,
      activeClass:
        "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25",
      iconClass: "text-cyan-400",
    },
    {
      path: "/repositories",
      label: "Repositories",
      icon: FolderOpen,
      activeClass:
        "bg-teal-500/15 text-teal-300 border border-teal-500/25",
      iconClass: "text-teal-400",
    },
  ];

  // --- REPOSITORY WORKSPACE: Phụ thuộc Current Repository ---
  const repoNavItems = [
    {
      path: "/audit",
      label: "Audit Dashboard",
      icon: Activity,
      activeClass:
        "bg-violet-500/15 text-violet-300 border border-violet-500/25",
      iconClass: "text-violet-400",
    },
    {
      path: "/rules",
      label: "Rule Manager",
      icon: ShieldCheck,
      activeClass:
        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
      iconClass: "text-emerald-400",
    },
    {
      path: "/sandbox",
      label: "Rule Builder",
      icon: Wand2,
      activeClass:
        "bg-blue-500/15 text-blue-300 border border-blue-500/25",
      iconClass: "text-blue-400",
    },
    {
      path: "/history",
      label: "Audit History",
      icon: FileSearch,
      activeClass:
        "bg-amber-500/15 text-amber-300 border border-amber-500/25",
      iconClass: "text-amber-400",
    },
  ];

  // --- BOTTOM NAV: Nằm dưới cùng ---
  const bottomNavItems = [
    {
      path: "/presentations",
      label: "Presentations",
      icon: MonitorPlay,
      activeClass:
        "bg-rose-500/15 text-rose-300 border border-rose-500/25",
      iconClass: "text-rose-400",
    },
  ];

  const renderNavItems = (items) =>
    items.map(({ path, label, icon: Icon, activeClass, iconClass }) => (
      <button
        key={path}
        onClick={() => handleNav(path)}
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group",
          isPathActive(path)
            ? activeClass
            : "text-slate-400 hover:bg-white/8 hover:text-slate-200 border border-transparent",
        )}
        title={label}
      >
        <Icon
          size={20}
          className={cn(
            "shrink-0 transition-transform",
            iconClass,
            isPathActive(path) ? "scale-110" : "group-hover:scale-110",
          )}
        />
        {!isSidebarCollapsed && (
          <span className="font-bold text-sm whitespace-nowrap">{label}</span>
        )}
      </button>
    ));

  const sidebarContent = (
    <>
      {/* ── Logo Header ── */}
      <div className="flex items-center gap-3 p-6 whitespace-nowrap overflow-hidden shrink-0">
        <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-2 rounded-xl shadow-md shrink-0">
          <Shield size={24} className="text-white" />
        </div>
        <AnimatePresence>
          {!isSidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex flex-col overflow-hidden"
            >
              <span
                className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-violet-300"
                style={{ fontFamily: "Outfit" }}
              >
                AUDIT ENGINE
              </span>
              <span className="text-[9px] uppercase font-bold text-violet-400 tracking-widest bg-violet-500/10 px-1.5 rounded w-fit">
                Framework V{import.meta.env.VITE_APP_VERSION || "1.0.0"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
        >
          <X size={18} />
        </button>
      </div>
      {/* ── TOP: REPO SELECTOR ── */}
      <div className="px-3 mb-4 shrink-0 mt-1">
        <div
          className={cn(
            "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 transition-all",
            isSidebarCollapsed ? "text-center opacity-70" : "px-3 opacity-60",
          )}
        >
          {isSidebarCollapsed ? "Repo" : "Current repository"}
        </div>
        {!isSidebarCollapsed ? (
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 text-sm font-semibold cursor-pointer appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.75rem center",
              backgroundSize: "1rem",
            }}
          >
            {configuredRepos.map((repo) => (
              <option
                key={repo.id}
                value={repo.id}
                className="bg-slate-700 text-slate-200"
              >
                {repo.name}
              </option>
            ))}
          </select>
        ) : (
          <div
            className="flex justify-center items-center w-10 aspect-square bg-slate-700 rounded-xl border border-slate-600 mx-auto cursor-pointer hover:bg-slate-600 transition-colors"
            title={
              configuredRepos.find((r) => r.id === selectedRepoId)?.name ||
              "Select target"
            }
          >
            <FolderOpen size={18} className="text-violet-400" />
          </div>
        )}
      </div>
      {/* ── NAV ITEMS CONTAINER (Scrollable) ── */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar pb-4">
        {/* ── SECTION 1: GLOBAL VIEWS ── */}
        <div className="flex flex-col gap-1.5 px-3 mb-1 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2 mb-1.5 transition-all",
              isSidebarCollapsed ? "justify-center px-0" : "px-1",
            )}
          >
            {!isSidebarCollapsed ? (
              <>
                <Globe size={10} className="text-slate-500 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                  Global Views
                </span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-slate-600 opacity-70">
                •••
              </span>
            )}
          </div>
          {renderNavItems(globalNavItems)}
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 my-3 border-t border-slate-700 shrink-0" />

        {/* ── SECTION 2: REPOSITORY WORKSPACE ── */}
        <div className="flex flex-col gap-1.5 px-3 shrink-0">
          {/* Section header */}
          <div
            className={cn(
              "flex items-center gap-2 mb-1.5 transition-all",
              isSidebarCollapsed ? "justify-center px-0" : "px-1",
            )}
          >
            {!isSidebarCollapsed ? (
              <>
                <FolderOpen size={10} className="text-slate-500 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                  Repository Workspace
                </span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-slate-600 opacity-70">
                •••
              </span>
            )}
          </div>

          {/* Repo-scoped nav items */}
          {renderNavItems(repoNavItems)}
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 my-2 border-t border-slate-700 shrink-0" />

        {/* ── SECTION 3: SYSTEM INFO ── */}
        <div className="flex flex-col gap-1.5 px-3 mb-1 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2 mb-1.5 transition-all",
              isSidebarCollapsed ? "justify-center px-0" : "px-1",
            )}
          >
            {!isSidebarCollapsed ? (
              <>
                <MonitorPlay size={10} className="text-slate-500 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                  System Info
                </span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-slate-600 opacity-70">
                •••
              </span>
            )}
          </div>
          {renderNavItems(bottomNavItems)}
        </div>
      </div>{" "}
      {/* <-- End Nav Items Container --> */}
      {/* ── Footer ── */}
      <div className="p-4 border-t border-slate-700 mt-auto shrink-0 flex flex-col gap-2">
        <div
          className={cn(
            "flex items-center p-3 rounded-xl border mb-1",
            aiHealth.status === "healthy"
              ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
              : "bg-slate-700 border-slate-600 text-slate-500",
          )}
          title="AI System Health"
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              aiHealth.status === "healthy"
                ? "bg-emerald-400"
                : "bg-slate-400",
            )}
          />
          {!isSidebarCollapsed && (
            <span className="font-bold text-[11px] uppercase tracking-widest ml-3 whitespace-nowrap">
              AI {aiHealth.status}
            </span>
          )}
        </div>
        {/* ── User Profile ── */}
        {user && (
          <div
            className={cn(
              "flex items-center rounded-xl border border-slate-700 bg-slate-800/50 mb-1 transition-all",
              isSidebarCollapsed ? "p-2 justify-center" : "p-3 gap-3",
            )}
          >
            <img
              src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}&background=random`}
              alt={user.name}
              className="w-8 h-8 rounded-full shrink-0 border-2 border-violet-300"
              referrerPolicy="no-referrer"
            />
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            )}
            {!isSidebarCollapsed && !isAnonymous && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition-colors shrink-0"
                title="Đăng xuất"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => handleNav("/settings")}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group",
            isPathActive("/settings")
              ? "bg-slate-700 text-slate-200 border border-slate-600"
              : "text-slate-400 hover:bg-white/8 hover:text-slate-200 border border-transparent",
          )}
        >
          <Settings
            size={20}
            className={cn(
              "shrink-0 transition-transform",
              isPathActive("/settings")
                ? "rotate-45 text-slate-300"
                : "group-hover:rotate-45",
            )}
          />
          {!isSidebarCollapsed && (
            <span className="font-bold text-sm whitespace-nowrap">
              Settings
            </span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[200] lg:hidden p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md transition-colors"
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
            className="fixed inset-0 bg-black/30 z-[150] lg:hidden"
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
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700 flex flex-col z-[200] shadow-xl lg:hidden overflow-y-auto"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.div
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 280 }}
        className="hidden lg:flex flex-shrink-0 bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700/50 flex-col relative z-[100] h-full transition-all duration-300"
      >
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3.5 top-8 bg-violet-600 hover:bg-violet-500 rounded-full p-1.5 shadow-md transition-colors z-50 flex items-center justify-center cursor-pointer"
        >
          {isSidebarCollapsed ? (
            <ChevronRight size={14} className="text-white" />
          ) : (
            <ChevronLeft size={14} className="text-white" />
          )}
        </button>
        {sidebarContent}
      </motion.div>
    </>
  );
};
