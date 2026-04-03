import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Shield, 
  ShieldCheck,
  Settings, 
  FileSearch, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3, 
  Code2,
  Search,
  Zap,
  FolderOpen,
  Upload,
  X,
  Wrench,
  CheckSquare,
  Users,
  Wand2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  Trash2
} from 'lucide-react';

import {
  Chart as ChartJS,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  RadialLinearScale, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, ArcElement,
  Filler, Tooltip, Legend
);

const RulesConfigurator = React.lazy(() => import('./components/nlre/RulesConfigurator'));
const HistoryView = React.lazy(() => import('./components/views/HistoryView'));
const SettingsView = React.lazy(() => import('./components/views/SettingsView'));
const AuditView = React.lazy(() => import('./components/views/AuditView'));
import Sidebar from './components/layout/Sidebar';
import { useAuditJob } from './hooks/useAuditJob';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const [activeTab, setActiveTab] = useState('remote'); // 'local' or 'remote'
  const location = useLocation();
  const navigate = useNavigate();
  const [reportView, setReportView] = useState('project'); // 'project' or 'member'
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState('project'); // legacy, kept for safety
  const [expandedMember, setExpandedMember] = useState(null);
  const [configuredRepos, setConfiguredRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  
  // Fetch configured repositories on mount
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch('/api/repositories');
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success') {
            setConfiguredRepos(result.data);
            if (result.data.length > 0) {
                setSelectedRepoId(result.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch configured repositories:", err);
      }
    };
    fetchRepos();
  }, []);

  const handleRepoUrlChange = (e) => {
    const val = e.target.value;
    setRepoUrl(val);
    try {
      if (val.includes('bitbucket.org') || val.includes('github.com') || val.includes('gitlab.com')) {
        let cleanVal = val.trim();
        // Remove trailing slash if exists
        if (cleanVal.endsWith('/')) cleanVal = cleanVal.slice(0, -1);
        
        const urlObj = new URL(cleanVal);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        
        if (parts.length >= 2) {
          const user = parts[0];
          const repo = parts[1].replace('.git', '');
          setRepoUsername(user);
          
          // Construct a clean .git URL if not already one
          let finalGitUrl = cleanVal;
          if (!cleanVal.endsWith('.git')) {
             finalGitUrl = `https://${urlObj.host}/${user}/${repo}.git`;
          }
          setRepoUrl(finalGitUrl);
        }
      }
    } catch(err) {
      // Ignore invalid URLs while typing
    }
  };
  const [repoUsername, setRepoUsername] = useState('');
  const [repoToken, setRepoToken] = useState('');
  
  // TÍCH HỢP HOOK KIỂM TOÁN V6 (BACKGROUND JOBS)
  const { 
      status: auditStatus, 
      error: auditError, 
      result: auditResult, 
      jobId, 
      message: auditMessage, 
      startAudit, 
      stopAudit 
  } = useAuditJob();
  
  const isAuditing = auditStatus === 'starting' || auditStatus === 'running';

  const [folderName, setFolderName] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  // Đồng bộ kết quả (result) và lỗi (error) từ Hook sang State nội bộ do History cần dùng chung biến data
  useEffect(() => {
     if (auditResult) {
         setData(auditResult);
     }
  }, [auditResult]);

  useEffect(() => {
     if (auditError) {
         setError(auditError);
     }
  }, [auditError]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [preparingProgress, setPreparingProgress] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [aiHealth, setAiHealth] = useState({ status: 'checking', model: '' });
  const [history, setHistory] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [fixingId, setFixingId] = useState(null);
  const [suggestions, setSuggestions] = useState({});

  const filesRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check AI Health on mount
  useEffect(() => {
    const checkAi = async () => {
      try {
        const res = await fetch('/api/health/ai');
        if (res.ok) {
          const d = await res.json();
          setAiHealth(d);
        } else {
          setAiHealth({ status: 'unhealthy', reason: 'Server error' });
        }
      } catch (err) {
        setAiHealth({ status: 'unhealthy', reason: err.message });
      }
    };
    checkAi();
  }, []);

  const fetchFixSuggestion = async (violation) => {
    if (fixingId === violation.id) return;
    setFixingId(violation.id);
    try {
      const res = await fetch('/api/audit/fix-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: violation.file,
          snippet: violation.snippet,
          reason: violation.reason
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(prev => ({ ...prev, [violation.id]: data.suggestion }));
      }
    } catch (err) {
      console.error("Fix error:", err);
    } finally {
      setFixingId(null);
    }
  };



  // Reset visible limit on view change
  useEffect(() => {
    setVisibleLimit(50);
  }, [data, reportView, selectedMember]);

  // Đồng bộ selectedMember khi data thay đổi (tránh lỗi stale author từ dự án cũ)
  useEffect(() => {
    if (data?.scores?.members) {
      const memberKeys = Object.keys(data.scores.members);
      if (memberKeys.length > 0) {
        // Nếu member cũ không còn tồn tại trong list mới -> reset về người đầu tiên
        if (!selectedMember || !memberKeys.includes(selectedMember)) {
          setSelectedMember(memberKeys[0]);
        }
      } else {
        setSelectedMember(null);
      }
    } else {
      setSelectedMember(null);
    }
  }, [data]);

  // Phục hồi trạng thái (State Recovery) & Đồng bộ
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/audit/status');
        const d = await res.json();
        
        if (d.is_running && !isAuditing) {
          setIsAuditing(true);
        } else if (!d.is_running && isAuditing) {
          setIsAuditing(false);
          setIsCancelling(false);
          setIsPreparing(false);
          setUploadProgress(0);
        }
      } catch (err) {
        // Bỏ qua lỗi kết nối tạm thời
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [isAuditing]);

  // Tự động nạp kết quả kiểm toán gần nhất khi mở trang hoặc thay đổi dự án
  useEffect(() => {
    const loadTargetAudit = async () => {
      let target = null;
      if (activeTab === 'remote' && selectedRepoId) {
        const repo = configuredRepos.find(r => r.id === selectedRepoId);
        if (repo) target = repo.url;
      } else if (activeTab === 'local' && folderName) {
        target = folderName;
      }

      if (!target) return;

      try {
        const response = await fetch(`/api/history?target=${encodeURIComponent(target)}`);
        if (response.ok) {
          const result = await response.json();
          if (result && result.length > 0 && result[0].full_json) {
            setData(result[0].full_json);
          } else {
            setData(null); // Reset nếu chưa bao giờ audit dự án này
          }
        }
      } catch (err) {
        console.error("Failed to load target audit:", err);
      }
    };
    loadTargetAudit();
  }, [selectedRepoId, folderName, activeTab, configuredRepos]);

  // Xoá logic EventSource bên trong App vì đã chuyển sang TerminalLogs

  const handleFolderSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    filesRef.current = files; // Lưu vào ref để tránh lag React state
    setFileCount(files.length);
    setError(null);
    setData(null);
    // Lấy tên thư mục từ file đầu tiên
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const name = firstPath.split('/')[0] || 'project';
    setFolderName(name);
  };

  const runAudit = async () => {
    if (activeTab === 'remote') {
      if (!selectedRepoId) {
        setError('Vui lòng chọn một dự án từ danh sách.');
        return;
      }
      setError(null);
      setData(null);
      
      // Khởi động bằng Hook
      startAudit({ id: selectedRepoId }, false);
      return;
    }

    const files = filesRef.current;
    if (!files || files.length === 0) {
      setError('Vui lòng chọn một thư mục để kiểm toán.');
      return;
    }
    
    setIsPreparing(true);
    setError(null);
    setData(null);
    setUploadProgress(0);
    setPreparingProgress(0);

    try {
      const formData = new FormData();
      const total = files.length;
      const batchSize = 5000;
      
      // Xử lý theo đợt để không treo Main Thread (Hàng chục ngàn file)
      for (let i = 0; i < total; i += batchSize) {
        for (let j = i; j < Math.min(i + batchSize, total); j++) {
          const file = files[j];
          formData.append('files', file, file.webkitRelativePath || file.name);
        }
        
        const currentCount = Math.min(i + batchSize, total);
        const progress = Math.min(Math.round((currentCount / total) * 100), 100);
        setPreparingProgress(progress);
        
        // Nhường CPU cho UI render
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      setIsPreparing(false);
      setUploadProgress(100); // Ảo upload progress xí cho vui vì background lo
      
      startAudit(formData, true);
      
    } catch (err) {
      console.error("CHI TIẾT LỖI TẠO UPLOAD:", err);
      setError(err.message);
    } finally {
      setIsPreparing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const fetchHistory = async (path) => {
    try {
      const response = await fetch(`/api/history?target=${encodeURIComponent(path)}`);
      if (response.ok) {
        const historyData = await response.json();
        setHistory(historyData.reverse());
      }
    } catch (err) {
      console.error("Lỗi lấy lịch sử:", err);
    }
  };

  useEffect(() => {
    if (data?.target) {
      fetchHistory(data.target);
    }
  }, [data]);

  const getSeverityClass = (weight) => {
    if (weight <= -5) return 'status-high';
    if (weight <= -3) return 'status-medium';
    return 'status-low';
  };

  // Removed duplicate getScoreColorClass



  // Để dùng hàm `cn` nếu cần class ghép
  const cn = (...classes) => classes.filter(Boolean).join(' ');

  return (
    <div className="flex h-screen w-screen bg-[#020617] overflow-hidden font-sans text-slate-200">
      
      {/* SIDEBAR */}
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed}
        selectedRepoId={selectedRepoId} setSelectedRepoId={setSelectedRepoId}
        configuredRepos={configuredRepos}
        aiHealth={aiHealth}
        isLightMode={isLightMode} setIsLightMode={setIsLightMode}
        cn={cn}
      />
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto relative no-scrollbar bg-transparent">
        {/* Decorative background blobs */}
        <div style={{
          position: 'fixed', top: '5%', right: '10%', width: '40vw', height: '40vw',
          background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none', opacity: 0.1
        }} />
        <div style={{
          position: 'fixed', bottom: '10%', left: '5%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, #ddd6fe 0%, transparent 70%)', filter: 'blur(120px)', zIndex: -1, pointerEvents: 'none', opacity: 0.1
        }} />

        <div className="dashboard-container relative z-10 w-full min-h-screen flex flex-col pb-8">
          <header className={cn("flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-navbar/30 border-white/5 shrink-0", location.pathname.startsWith('/audit') || location.pathname === '/' ? "mb-10" : "mb-6")}>
            {/* Context Title */}
            <div className="flex flex-col">
               <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 drop-shadow-sm mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                 {location.pathname.startsWith('/audit') || location.pathname === '/' ? 'AUDIT DASHBOARD' : location.pathname.startsWith('/rules') ? 'RULE MANAGER' : location.pathname.startsWith('/settings') ? 'SYSTEM SETTINGS' : location.pathname.startsWith('/history') ? 'AUDIT HISTORY' : 'AI SANDBOX'}
               </h1>
               <p className="font-bold text-slate-500 uppercase tracking-widest text-xs flex items-center gap-2">
                 {location.pathname.startsWith('/audit') || location.pathname === '/' ? 'Thống kê & Mức độ an toàn mã nguồn' : location.pathname.startsWith('/rules') ? 'Quản lý cấu hình luật mặc định và tuỳ chỉnh' : location.pathname.startsWith('/settings') ? 'Cài đặt và thiết lập hệ thống cảnh báo' : location.pathname.startsWith('/history') ? 'Tra cứu và phục hồi kết quả phân tích lịch sử' : 'Thiết kế luật mới bằng AI & Kiểm chứng'}
               </p>
            </div>

            {(location.pathname.startsWith('/audit') || location.pathname === '/') && (
              <div className="flex items-center gap-4 flex-wrap justify-end ml-auto bg-black/20 p-2.5 rounded-2xl border border-white/5">
                <button 
                  className="btn-audit" 
                  onClick={runAudit} 
                  disabled={isAuditing || !selectedRepoId}
                >
                  {isAuditing ? <Zap className="spin" size={16} /> : <Zap size={16} />}
                  <span>
                    {isAuditing 
                      ? (isCancelling ? 'ĐANG HỦY...' : 'AUDITING...') 
                      : 'PHÂN TÍCH REPO'}
                  </span>
                </button>
                
                {isAuditing && (
                  <button 
                    onClick={async () => {
                      setIsCancelling(true);
                      try { await fetch('/api/audit/cancel', { method: 'POST' }); } catch(e){}
                    }} 
                    disabled={isCancelling}
                    className="btn-stop"
                    title="Hủy kiểm toán"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/audit" replace />} />
        <Route path="/rules" element={
          <div key="view-rules" className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <Suspense fallback={<div className="p-8 text-white">Đang tải Rules...</div>}>
              <RulesConfigurator 
                targetId={selectedRepoId} 
                projectName={configuredRepos.find(r => r.id === selectedRepoId)?.name || selectedRepoId} 
                mode="manager"
              />
            </Suspense>
          </div>
        } />
        <Route path="/sandbox" element={
          <div key="view-sandbox" className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <Suspense fallback={<div className="p-8 text-white">Đang tải Sandbox...</div>}>
              <RulesConfigurator 
                targetId={selectedRepoId} 
                projectName={configuredRepos.find(r => r.id === selectedRepoId)?.name || selectedRepoId} 
                mode="sandbox"
              />
            </Suspense>
          </div>
        } />
        <Route path="/settings" element={
          <div className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <Suspense fallback={<div className="p-8 text-white">Đang tải Settings...</div>}>
              <SettingsView selectedRepoId={selectedRepoId} cn={cn} />
            </Suspense>
          </div>
        } />
        <Route path="/history" element={
          <div className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <Suspense fallback={<div className="p-8 text-white">Đang tải History...</div>}>
              <HistoryView 
                selectedRepoId={selectedRepoId}
                targetUrl={configuredRepos.find(r => r.id === selectedRepoId)?.url}
                onRestoreAudit={(fullJson) => {
                  setData(fullJson);
                  navigate('/audit');
                }} 
                cn={cn} 
              />
            </Suspense>
          </div>
        } />
        <Route path="/audit" element={
          <Suspense fallback={<div className="p-8 text-white">Đang tải...</div>}>
            <AuditView
              data={data}
              error={error}
              isAuditing={isAuditing}
              jobId={jobId}
              reportView={reportView}
              setReportView={setReportView}
              selectedMember={selectedMember}
              setSelectedMember={setSelectedMember}
              activeLedgerTab={activeLedgerTab}
              visibleLimit={visibleLimit}
              setVisibleLimit={setVisibleLimit}
              fixingId={fixingId}
              suggestions={suggestions}
              fetchFixSuggestion={fetchFixSuggestion}
              activeTab={activeTab}
              getSeverityClass={getSeverityClass}
              cn={cn}
            />
          </Suspense>
        } />
      </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;


