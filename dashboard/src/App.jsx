import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { Radar, Line, Doughnut, Bar } from 'react-chartjs-2';
import RulesConfigurator from './components/nlre/RulesConfigurator';

ChartJS.register(
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

// --- COMPONENT: TerminalLogs ---
// Tách biệt Terminal để tránh re-render toàn bộ App mỗi khi có log mới từ SSE
const TerminalLogs = React.memo(({ isAuditing }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const logsEndRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    let eventSource;
    if (isAuditing) {
      setAuditLogs([]);
      eventSource = new EventSource('/api/audit/logs');
      eventSource.onmessage = (e) => {
        setAuditLogs(prev => {
           const newLogs = [...prev, e.data];
           // Chỉ giữ lại tối đa 300 dòng cuối để tránh crash trình duyệt
           return newLogs.length > 300 ? newLogs.slice(newLogs.length - 300) : newLogs;
        });
      };
      eventSource.onerror = () => {
        // Silent error
      };
    }
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isAuditing]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [auditLogs]);

  if (!isAuditing) return null;

  return (
    <div 
      ref={terminalRef} 
      className="glass-card"
      style={{ 
        background: 'rgba(0, 0, 0, 0.5)', 
        backdropFilter: 'blur(8px)',
        padding: '1.25rem', 
        borderRadius: '16px', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        marginBottom: '2rem', 
        height: '65vh', 
        minHeight: '500px', 
        overflowY: 'auto', 
        fontFamily: 'JetBrains Mono, monospace', 
        fontSize: '0.9rem', 
        color: '#34d399', 
        boxShadow: 'none' 
      }}
    >
      <div style={{ color: '#cbd5e1', marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Zap size={14} /> CORE AUDITOR LOGS
      </div>
      {auditLogs.map((log, idx) => (
        <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.5', borderLeft: '1px solid rgba(16, 185, 129, 0.2)', paddingLeft: '0.75rem' }}>{log}</div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );
});

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
               
               <div className="flex items-center">
                   <button 
                       onClick={handleReset}
                       disabled={isResetting || !selectedRepoId}
                       className={cn(
                         "px-6 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 shadow-lg duration-300",
                         isResetting ? "bg-slate-800 text-slate-500 cursor-not-allowed" :
                         confirmReset 
                             ? "bg-red-600 text-white border border-red-500 shadow-red-500/30 scale-105" 
                             : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white disabled:opacity-50"
                       )}
                   >
                       {isResetting ? <Zap className="animate-spin" size={18} /> : (confirmReset ? <AlertTriangle size={18} className="animate-pulse" /> : <Trash2 size={18} />)}
                       {isResetting ? "ĐANG TIẾN HÀNH..." : (confirmReset ? "XÁC NHẬN RESET DỮ LIỆU" : "Khôi Phục Mặc Định (Reset)")}
                   </button>
               </div>
          </div>
      </div>
    </div>
  );
};

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
  const [mainView, setMainView] = useState('audit'); // 'audit', 'rules', 'sandbox'
  const [reportView, setReportView] = useState('project'); // 'project' or 'member'
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState('project'); // legacy, kept for safety
  const [expandedMember, setExpandedMember] = useState(null);
  const [configuredRepos, setConfiguredRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  
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
  
  const [folderName, setFolderName] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
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
      setIsAuditing(true);
      setError(null);
      setData(null);
      try {
        const response = await fetch('/api/audit/repository', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedRepoId
          })
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || `Server error: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsAuditing(false);
      }
      return;
    }

    const files = filesRef.current;
    if (!files || files.length === 0) {
      setError('Vui lòng chọn một thư mục để kiểm toán.');
      return;
    }
    
    setIsAuditing(true);
    setIsPreparing(true);
    setError(null);
    setData(null);
    setUploadProgress(0);
    setPreparingProgress(0);

    try {
      const formData = new FormData();
      const total = files.length;
      const batchSize = 5000;
      
      // Xử lý theo đợt để không treo Main Thread
      for (let i = 0; i < total; i += batchSize) {
        // Sử dụng Array.from chỉ cho phần chunk để tránh tạo mảng khổng lồ cùng lúc
        for (let j = i; j < Math.min(i + batchSize, total); j++) {
          const file = files[j];
          formData.append('files', file, file.webkitRelativePath || file.name);
        }
        
        // Cập nhật tiến trình chuẩn bị
        const currentCount = Math.min(i + batchSize, total);
        const progress = Math.min(Math.round((currentCount / total) * 100), 100);
        setPreparingProgress(progress);
        
        // Nhường CPU cho UI render
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      setIsPreparing(false);
      setUploadProgress(10); // Bắt đầu upload
      
      console.log("Bắt đầu Audit với fetch tới /api/audit/process...");
      const response = await fetch('/api/audit/process', {
        method: 'POST',
        body: formData
      });

      console.log("Phản hồi từ server:", response.status);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }

      setUploadProgress(100);
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("CHI TIẾT LỖI AUDIT:", err);
      // Xử lý lỗi đặc thù cho Brave Shields/Network
      if (err.message === 'Failed to fetch') {
         setError('Lỗi kết nối: Brave đang chặn yêu cầu. Thử: F12 -> Console để xem chi tiết hoặc Tắt Shields hoàn toàn.');
      } else {
         setError(err.message === 'Kiểm toán đã bị hủy bởi người dùng.' ? 'Đã hủy kiểm toán.' : err.message);
      }
    } finally {
      setIsAuditing(false);
      setIsCancelling(false);
      setUploadProgress(0);
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

  const getScoreColorClass = (score) => {
    if (score < 5) return '#ef4444'; // red-500
    if (score < 8) return '#f59e0b'; // amber-500
    return '#10b981'; // emerald-500
  };


  // Tính toán dữ liệu cho các biểu đồ mới
  const getViolationDistributionData = (violationsList) => {
    if (!violationsList) return null;
    const counts = { Performance: 0, Maintainability: 0, Reliability: 0, Security: 0 };
    violationsList.forEach(v => {
      if (counts[v.pillar] !== undefined) counts[v.pillar]++;
    });
    return {
      labels: ['Hiệu năng', 'Bảo trì', 'Độ tin cậy', 'Bảo mật'],
      datasets: [{
        data: [counts.Performance, counts.Maintainability, counts.Reliability, counts.Security],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderWidth: 0,
      }]
    };
  };

  const getSeverityDistributionData = (violationsList) => {
    if (!violationsList) return null;
    let high = 0, medium = 0, low = 0;
    violationsList.forEach(v => {
      if (v.weight <= -5) high++;
      else if (v.weight <= -3) medium++;
      else low++;
    });
    return {
      labels: ['Nghiêm trọng (High)', 'Trung bình (Medium)', 'Nhẹ (Low)'],
      datasets: [{
        label: 'Số lượng vi phạm',
        data: [high, medium, low],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)'
        ],
      }]
    };
  };

  const getTopProblematicFiles = (violationsList) => {
    if (!violationsList) return [];
    const fileCounts = {};
    violationsList.forEach(v => {
      fileCounts[v.file] = (fileCounts[v.file] || 0) + 1;
    });
    return Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  // Tính toán dữ liệu cho biểu đồ Radar (Theo từng Tính năng hoặc Trụ cột Thành viên)
  const getRadarChartData = () => {
    if (!data || !data.scores) return null;
    if (reportView === 'project') {
      if (!data.scores.features) return null;
      return {
        labels: Object.keys(data.scores.features),
        datasets: [
          {
            label: 'Feature Score',
            data: Object.values(data.scores.features).map(f => f.final),
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: '#3b82f6',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
          },
        ],
      };
    } else if (reportView === 'member' && selectedMember && data.scores.members?.[selectedMember]) {
      const mbr = data.scores.members[selectedMember];
      if (!mbr.pillars) return null;
      return {
        labels: Object.keys(mbr.pillars),
        datasets: [
          {
            label: 'Pillar Score',
            data: Object.values(mbr.pillars).map(s => s * 10), // quy đổi base 10 thành 100
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderColor: '#10b981',
            borderWidth: 2,
            pointBackgroundColor: '#10b981',
          },
        ],
      };
    }
    return null;
  };

  const chartOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: { 
          color: '#f8fafc', 
          font: { 
            size: 11, 
            weight: '800',
            family: 'Outfit'
          } 
        },
        ticks: { display: false, stepSize: 20 },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
      }
    }
  };

  // ----- TỐI ƯU HÓA HIỆU NĂNG BIỂU ĐỒ (MEMOIZATION) & AN TOÀN DỮ LIỆU -----
  const chartCurrentViolations = useMemo(() => {
    if (!data) return [];
    if (reportView === 'project') return data.violations || [];
    return data.scores?.members?.[selectedMember]?.violations || [];
  }, [data, reportView, selectedMember]);

  const memoizedViolationDistData = useMemo(() => getViolationDistributionData(chartCurrentViolations), [chartCurrentViolations]);
  const memoizedSeverityDistData = useMemo(() => getSeverityDistributionData(chartCurrentViolations), [chartCurrentViolations]);
  const memoizedTopFiles = useMemo(() => getTopProblematicFiles(chartCurrentViolations), [chartCurrentViolations]);
  const memoizedRadarData = useMemo(() => getRadarChartData(), [data, reportView, selectedMember]);

  // Để dùng hàm `cn` nếu cần class ghép
  const cn = (...classes) => classes.filter(Boolean).join(' ');

  return (
    <div className="flex h-screen w-screen bg-[#020617] overflow-hidden select-none font-sans text-slate-200">
      
      {/* SIDEBAR */}
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
              onClick={() => setMainView('audit')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", mainView === 'audit' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="Dashboard Analytics"
           >
              <Activity size={20} className={cn("shrink-0 transition-transform", mainView === 'audit' ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Dashboard</span>}
           </button>
           
           <button 
              onClick={() => setMainView('rules')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", mainView === 'rules' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="Rule Manager"
           >
              <ShieldCheck size={20} className={cn("shrink-0 transition-transform", mainView === 'rules' ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Danh sách Rule</span>}
           </button>
           
           <button 
              onClick={() => setMainView('sandbox')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", mainView === 'sandbox' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent')}
              title="AI Sandbox"
           >
              <Wand2 size={20} className={cn("shrink-0 transition-transform", mainView === 'sandbox' ? "scale-110" : "group-hover:scale-110")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Tạo Rule AI</span>}
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
              onClick={() => setMainView('settings')}
              className={cn("flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left overflow-hidden shrink-0 group", mainView === 'settings' ? "bg-slate-500/10 text-slate-400 border border-slate-500/20 shadow-inner" : "text-slate-500 hover:bg-white/5 hover:text-slate-300 border border-transparent")}
           >
              <Settings size={20} className={cn("shrink-0 transition-transform", mainView === 'settings' ? "rotate-45 text-slate-300" : "group-hover:rotate-45")} />
              {!isSidebarCollapsed && <span className="font-bold text-sm whitespace-nowrap">Cài đặt Cấu hình</span>}
           </button>
        </div>
      </motion.div>

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
          <header className={cn("flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-navbar/30 border-white/5 shrink-0", mainView === 'audit' ? "mb-10" : "mb-6")}>
            {/* Context Title */}
            <div className="flex flex-col">
               <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 drop-shadow-sm mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                 {mainView === 'audit' ? 'AUDIT DASHBOARD' : mainView === 'rules' ? 'RULE MANAGER' : mainView === 'settings' ? 'SYSTEM SETTINGS' : 'AI SANDBOX'}
               </h1>
               <p className="font-bold text-slate-500 uppercase tracking-widest text-xs flex items-center gap-2">
                 {mainView === 'audit' ? 'Thống kê & Mức độ an toàn mã nguồn' : mainView === 'rules' ? 'Quản lý cấu hình luật mặc định và tuỳ chỉnh' : mainView === 'settings' ? 'Cài đặt và thiết lập hệ thống cảnh báo' : 'Thiết kế luật mới bằng AI & Kiểm chứng'}
               </p>
            </div>

            {mainView === 'audit' && (
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

      {mainView === 'rules' ? (
        <div key="view-rules" className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
          <RulesConfigurator 
            targetId={selectedRepoId} 
            projectName={configuredRepos.find(r => r.id === selectedRepoId)?.name || selectedRepoId} 
            mode="manager"
          />
        </div>
      ) : mainView === 'sandbox' ? (
        <div key="view-sandbox" className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
          <RulesConfigurator 
            targetId={selectedRepoId} 
            projectName={configuredRepos.find(r => r.id === selectedRepoId)?.name || selectedRepoId} 
            mode="sandbox"
          />
        </div>
      ) : mainView === 'settings' ? (
        <div className="flex-1 flex flex-col w-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
          <SettingsView selectedRepoId={selectedRepoId} cn={cn} />
        </div>
      ) : (
        <>
      {/* Terminal Mini (Chỉ hiện khi đang Quét) */}
      <TerminalLogs isAuditing={isAuditing} />

      {/* Thông báo lỗi */}
      {error && (
        <div className="glass-card" style={{ borderColor: 'var(--accent-red)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
          <AlertTriangle size={24} />
          <div>
            <strong>Lỗi thực thi:</strong> {error}
          </div>
        </div>
      )}

      {data ? (
        <>
          {/* TOP LEVEL TOGGLE */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', borderBottom: '1px solid rgba(15,23,42,0.05)', paddingBottom: '1.25rem' }}>
            <button 
              onClick={() => setReportView('project')}
              style={{ 
                padding: '0.8rem 1.75rem', 
                background: reportView === 'project' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', 
                color: reportView === 'project' ? '#60a5fa' : '#94a3b8', 
                border: reportView === 'project' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 800, 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                fontSize: '0.9rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              <Activity size={18} /> Project View
            </button>
            <button 
              onClick={() => {
                 setReportView('member');
                 if (!selectedMember && data.scores.members && Object.keys(data.scores.members).length > 0) {
                   setSelectedMember(Object.keys(data.scores.members)[0]);
                 }
              }}
              style={{ 
                padding: '0.8rem 1.75rem', 
                background: reportView === 'member' ? 'rgba(139, 92, 246, 0.15)' : 'transparent', 
                color: reportView === 'member' ? '#a78bfa' : '#94a3b8', 
                border: reportView === 'member' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 800, 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                fontSize: '0.9rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              disabled={!data.scores.members || Object.keys(data.scores.members).length === 0}
            >
              <Users size={18} /> Team Analytics
            </button>
          </div>

          {/* Member Selector when in Member Report mode */}
          {reportView === 'member' && data.scores.members && Object.keys(data.scores.members).length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Tác giả:</span>
              <select 
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', outline: 'none', fontSize: '1rem', cursor: 'pointer', minWidth: '200px' }}
              >
                {Object.keys(data.scores.members).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Khối các chỉ số tổng quan (Hero Card + Features) */}
          <div className="stats-grid">
            {/* --- HERO CARD (Spans 4 columns) --- */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="glass-card hero-card col-span-4" 
              style={{ 
                borderColor: reportView === 'member' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                background: 'rgba(15, 23, 42, 0.6)',
                boxShadow: '0 20px 50px -15px rgba(0,0,0,0.5)'
              }}
            >
              <div className="hero-left">
                <div className="metric-label" style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {reportView === 'member' ? <><Users size={20} className="text-emerald-400" /> TỔNG QUAN THÀNH VIÊN: {selectedMember}</> : <><Activity size={20} className="text-blue-400" /> TỔNG QUAN DỰ ÁN</>}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '1.25rem' }}>
                  <div className="metric-value" style={{ 
                    fontSize: '5rem',
                    fontWeight: 900,
                    lineHeight: '1',
                    letterSpacing: '-0.03em',
                    color: getScoreColorClass((reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)) / 10)
                  }}>
                    {reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)}
                  </div>
                  <span style={{ fontSize: '1.5rem', color: '#64748b', marginLeft: '0.75rem', fontWeight: 700 }}>/ 100</span>
                </div>
                
                {reportView === 'project' && (
                  <div style={{ marginTop: '1.25rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem' }}>
                    XẾP HẠNG: <span className="status-badge" style={{ fontSize: '1.25rem', padding: '0.6rem 1.25rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '14px', color: '#f8fafc' }}>{data.scores.rating}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '2.5rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng số dòng Code</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc' }}>
                      {reportView === 'project' ? data?.metrics?.total_loc?.toLocaleString() : (data?.scores?.members?.[selectedMember]?.loc || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{reportView === 'project' ? 'Số lượng tính năng' : 'Nợ kỹ thuật'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: reportView === 'member' ? '#f59e0b' : '#f8fafc' }}>
                      {reportView === 'project' ? Object.keys(data?.scores?.features || {}).length : `${data?.scores?.members?.[selectedMember]?.debt_mins || 0}m`}
                    </div>
                  </div>
                </div>

                {/* 4 Trụ cột Dự án / Thành viên */}
                <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', width: '100%' }}>
                  {Object.entries(reportView === 'project' ? (data?.scores?.project_pillars || {}) : (data?.scores?.members?.[selectedMember]?.pillars || {})).map(([pillar, score]) => (
                    <div key={pillar}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{pillar}</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: getScoreColorClass(score) }}>{score}<span style={{ fontSize: '0.75rem', opacity: 0.5 }}>/10</span></span>
                      </div>
                      <div className="progress-track" style={{ height: '8px', background: 'rgba(15,23,42,0.05)', borderRadius: '10px' }}>
                        <div className="progress-fill" style={{ width: `${score * 10}%`, background: getScoreColorClass(score), boxShadow: `0 4px 12px ${getScoreColorClass(score)}33`, borderRadius: '10px' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-right">
                <div style={{ width: '100%', height: '100%', maxWidth: '380px', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.06))' }}>
                  <Radar 
                    data={memoizedRadarData} 
                    options={chartOptions} 
                  />
                </div>
              </div>
            </motion.div>
            {/* --- END HERO CARD --- */}
            
            {/* DANH SÁCH TÍNH NĂNG */}
            {reportView === 'project' && Object.entries(data.scores.features).map(([name, feat]) => (
                <div 
                    key={name} 
                    className="glass-card" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.6rem',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '1.25rem',
                        borderRadius: '16px'
                    }}
                >
                    <div className="metric-label" style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase' }}>
                        <FolderOpen size={14} /> {name}
                    </div>
                    <div className="metric-value" style={{ fontSize: '2.25rem', fontWeight: 800, color: getScoreColorClass(feat.final / 10), letterSpacing: '-0.02em' }}>
                        {feat.final}<span style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '2px' }}>/100</span>
                    </div>
                    
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* 4 Pillars within feature */}
                        {Object.entries(feat.pillars).map(([pillar, p_score]) => (
                            <div key={pillar} style={{ fontSize: '0.7rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>{pillar}</span>
                                    <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{p_score}/10</span>
                                </div>
                                <div className="progress-track" style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                    <div className="progress-fill" style={{ width: `${p_score * 10}%`, backgroundColor: getScoreColorClass(p_score), borderRadius: '10px' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                         <div style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Zap size={10} /> {feat.debt_mins}m DEBT
                         </div>
                         <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {feat.loc.toLocaleString()} LOC
                         </div>
                    </div>
                </div>
            ))}
            
            {/* DANH SÁCH THÀNH VIÊN (MEMBER LEADERBOARD) */}
            {reportView === 'project' && data.scores.members && Object.keys(data.scores.members).length > 0 && (
                <div 
                    className="glass-card col-span-4" 
                    style={{ 
                        marginTop: '0.5rem', 
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '1.5rem',
                        borderRadius: '16px'
                    }}
                >
                    <div className="metric-label" style={{ color: '#10b981', fontWeight: 800, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}>
                        <Users size={18} /> TEAM LEADERBOARD
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Author</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Total LOC</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Score</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Debt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(data?.scores?.members || {})
                                  .sort((a, b) => (b[1]?.final || 0) - (a[1]?.final || 0))
                                  .map(([author, res], idx) => (
                                    <tr key={author} style={{ background: 'rgba(255,255,255,0.02)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#f8fafc', borderRadius: '8px 0 0 8px' }}>{author}</td>
                                        <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8' }}>{res.loc.toLocaleString()} lines</td>
                                        <td style={{ padding: '0.75rem 0.5rem', color: getScoreColorClass(res.final / 10), fontWeight: 800, fontSize: '1.1rem' }}>{res.final}</td>
                                        <td style={{ padding: '0.75rem 0.5rem', color: '#f59e0b', fontWeight: 700, borderRadius: '0 8px 8px 0' }}>{res.debt_mins}m</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
          </div>

          {/* Hàng biểu đồ phân tích mới */}
          <div className="charts-row">
            <div 
               className="chart-card glass-card"
               style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <h3 className="chart-title" style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}><Activity size={18} color="#3b82f6" /> VIOLATION DISTRIBUTION</h3>
              <div className="chart-container" style={{ height: '240px' }}>
                {memoizedViolationDistData && <Doughnut data={memoizedViolationDistData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { weight: '600', size: 10 } } } } }} />}
              </div>
            </div>
            
            <div 
               className="chart-card glass-card"
               style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <h3 className="chart-title" style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}><Shield size={18} color="#ef4444" /> IMPACT SEVERITY</h3>
              <div className="chart-container" style={{ height: '240px' }}>
                {memoizedSeverityDistData && <Bar data={memoizedSeverityDistData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } }, plugins: { legend: { display: false } } }} />}
              </div>
            </div>
          </div>

          {/* Dashboard Main Content */}
          <div className="main-grid">
            {/* Danh sách vi phạm chi tiết */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div className="metric-label" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Code2 size={16} /> SỔ CÁI VI PHẠM (VIOLATION LEDGER)</span>
                  <span>{activeLedgerTab === 'project' ? (data?.violations?.length || 0) : (data?.scores?.members ? Object.keys(data.scores.members).length : 0)} {activeLedgerTab === 'project' ? 'vấn đề' : 'thành viên'}</span>
                </div>
                {/* 2 Tabs Removed */}
              </div>
              
              <div className="violation-list" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {(() => {
                  const currentViolations = reportView === 'project' ? (data?.violations || []) : (data?.scores?.members?.[selectedMember]?.violations || []);
                  const displayedViolations = currentViolations.slice(0, visibleLimit);
                  
                  return (
                    <>
                      {displayedViolations.map((v, i) => (
                        <div 
                          key={i} 
                          className="violation-item" 
                          style={{ 
                            borderLeftColor: v.weight <= -5 ? '#ef4444' : v.weight <= -3 ? '#f59e0b' : '#3b82f6',
                            background: 'rgba(0, 0, 0, 0.2)',
                            padding: '1rem',
                            borderRadius: '12px',
                            marginBottom: '0.75rem',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: 'rgba(255, 255, 255, 0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span className="violation-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem' }}>
                              {v.is_custom && <Sparkles size={14} style={{ color: '#f59e0b' }} title="Custom Rule" />}
                              {v.reason}
                            </span>
                            <span className={`status-badge ${getSeverityClass(v.weight)}`} style={{ fontWeight: 700, fontSize: '0.65rem' }}>
                              {v.is_custom ? 'CUSTOM' : v.pillar} | {v.weight >= 0 ? `+${v.weight}` : v.weight}
                            </span>
                          </div>
                          <div className="violation-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                            <Search size={12} color="#60a5fa" /> <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v.file}{v.line ? `:${v.line}` : ''}</span>
                          </div>
                          {v.snippet && (
                            <>
                              <pre style={{ 
                                marginTop: '1rem', 
                                padding: '1.25rem', 
                                background: 'rgba(0, 0, 0, 0.4)', 
                                borderRadius: '12px', 
                                fontSize: '0.85rem', 
                                overflowX: 'auto',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                color: '#e2e8f0'
                              }}>
                                <code style={{ color: '#bae6fd', fontWeight: 500 }}>{v.snippet}</code>
                              </pre>
                              
                                <button 
                                  className="btn-fix"
                                  onClick={() => fetchFixSuggestion(v)}
                                  disabled={fixingId === v.id}
                                  style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                  <Wand2 size={14} /> 
                                  {fixingId === v.id ? 'Thinking...' : suggestions[v.id] ? 'Re-generate' : 'Fix'}
                                </button>

                              {suggestions[v.id] && (
                                <div 
                                  className="fix-suggestion-block"
                                  style={{ 
                                    marginTop: '1rem',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    padding: '1rem'
                                  }}
                                >
                                  <div className="suggestion-header" style={{ color: '#10b981', fontWeight: 700, fontSize: '0.7rem', marginBottom: '0.4rem', textTransform: 'uppercase' }}>AI FIX</div>
                                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                    Recommended approach:
                                  </div>
                                  <code style={{ background: 'rgba(0,0,0,0.5)', padding: '0.75rem', borderRadius: '6px', display: 'block', color: '#bae6fd', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>{suggestions[v.id]}</code>
                                </div>
                              )}
                            </>
                          )}

                        </div>
                      ))}
                      
                      {currentViolations.length > visibleLimit && (
                        <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                           <button 
                             onClick={() => setVisibleLimit(prev => prev + 50)}
                             style={{ padding: '0.5rem 1.5rem', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem', fontWeight: 500 }}
                           >
                              Hiển thị thêm (Còn {currentViolations.length - visibleLimit} lỗi)
                           </button>
                        </div>
                      )}
                      
                      {currentViolations.length === 0 && reportView === 'project' && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                          <CheckCircle size={48} style={{ marginBottom: '1rem', color: 'var(--accent-green)', opacity: 0.5 }} />
                          <p>Chúc mừng! Không tìm thấy vi phạm nào.</p>
                        </div>
                      )}
                      
                      {reportView === 'member' && currentViolations.length === 0 && (!data.scores.members || Object.keys(data.scores.members).length === 0) && (
                         <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                           <p>Lịch sử Git rỗng. Báo cáo thành viên không khả dụng.</p>
                         </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Cột bên phải */}
            <div className="sidebar">
              <div className="glass-card">
                <div className="metric-label">THÔNG TIN KIỂM TOÁN</div>
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                    <span style={{ fontWeight: 600 }}>{data?.project_name || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Số lượng file:</span>
                    <span>{data?.metrics?.total_files || 0} files</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tiêu chuẩn:</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>V3 Stable</span>
                  </div>
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', textAlign: 'center' }}>
                      Hệ thống đã xác thực kết quả dựa trên cây cú pháp AST.
                    </p>
                  </div>
                </div>
                {/* Widget Top Problematic Files */}
                {memoizedTopFiles.length > 0 && (
                  <div className="glass-card" style={{ marginTop: '1.5rem', animation: 'fadeIn 0.6s ease-out' }}>
                    <h3 style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem', color: 'var(--text-main)' }}>
                      <FolderOpen size={18} color="var(--accent-yellow)" /> TOP FILE LỖI NHIỀU NHẤT
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {memoizedTopFiles.map(([filename, count], idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', wordBreak: 'break-all', paddingRight: '1rem' }}>{filename}</span>
                          <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', whiteSpace: 'nowrap' }}>{count} lỗi</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : !isAuditing ? (
        /* Trạng thái trống */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', opacity: 0.4 }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <BarChart3 size={80} style={{ color: 'var(--accent-blue)' }} />
            <Upload size={32} style={{ position: 'absolute', bottom: -10, right: -10 }} />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-display)' }}>Sẵn sàng để đánh giá mã nguồn</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {activeTab === 'local' 
              ? 'Chọn thư mục từ máy tính và nhấn nút ' 
              : 'Chọn dự án từ danh sách phía trên và nhấn nút '}
            <strong>Chạy Kiểm Toán</strong>
          </p>
        </div>
      ) : null}

      {/* Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { 
          animation: spin 2s linear infinite; 
          color: var(--accent-yellow);
        }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
      </>
      )}
        </div>
      </div>
    </div>
  );
}

export default App;
