import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Shield, 
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
  Users
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
    <div ref={terminalRef} style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '2rem', height: '65vh', minHeight: '500px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)' }}>
      <div style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.8rem', letterSpacing: '0.05em' }}>--- TIẾN TRÌNH KIỂM TOÁN LÕI (CORE AUDITOR LOGS) ---</div>
      {auditLogs.map((log, idx) => (
        <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.5' }}>{log}</div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );
});

function App() {
  const [activeTab, setActiveTab] = useState('remote'); // 'local' or 'remote'
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
  const filesRef = useRef(null);
  const fileInputRef = useRef(null);

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
    if (score < 5) return 'var(--accent-red)';
    if (score < 8) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
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
        pointLabels: { color: '#94a3b8', font: { size: 12, weight: '600' } },
        ticks: { display: false, stepSize: 20 },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false
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

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>SOFTWARE AUDIT ENGINE</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Hệ thống Kiểm toán Mã nguồn Tự động (Phân loại theo Tính năng)</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
          
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '8px' }}>
            <button 
              onClick={() => setActiveTab('local')}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: activeTab === 'local' ? 'var(--accent-blue)' : 'transparent', color: 'white', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Local Folder
            </button>
            <button 
              onClick={() => setActiveTab('remote')}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: activeTab === 'remote' ? 'var(--accent-blue)' : 'transparent', color: 'white', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Remote Repository
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {activeTab === 'local' ? (
              <div
                className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${folderName ? 'has-folder' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  fileInputRef.current?.click();
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFolderSelect}
                />
                {folderName ? (
                  <>
                    <FolderOpen size={16} color="var(--accent-blue)" />
                    <span className="upload-folder-name">{folderName}</span>
                    <span className="upload-file-count">({fileCount} files)</span>
                    <button
                      className="upload-clear"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        filesRef.current = null; 
                        setFileCount(0);
                        setFolderName(''); 
                        setData(null); 
                      }}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload size={16} color="var(--text-muted)" />
                    <span>Chọn thư mục để kiểm toán</span>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <select 
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', outline: 'none', fontSize: '0.875rem', cursor: 'pointer', minWidth: '300px' }}
                >
                  {configuredRepos.map(repo => (
                    <option key={repo.id} value={repo.id}>{repo.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-audit" onClick={runAudit} disabled={isAuditing || (activeTab === 'local' && fileCount === 0) || (activeTab === 'remote' && !selectedRepoId)}>
                {isAuditing ? <Zap className="spin" size={20} /> : <Zap size={20} />}
                {isAuditing 
                  ? (activeTab === 'remote' 
                    ? 'ĐANG CLONE & PHÂN TÍCH...' 
                    : (isPreparing 
                      ? `CHUẨN BỊ ${preparingProgress}%...`
                      : (uploadProgress > 0 && uploadProgress < 100 
                          ? `ĐANG UPLOAD ${uploadProgress}%...` 
                          : 'ĐANG PHÂN TÍCH...'))) 
                  : 'CHẠY KIỂM TOÁN'}
              </button>
              
              {isAuditing && (
                <button 
                  onClick={async () => {
                    setIsCancelling(true);
                    try { await fetch('/api/audit/cancel', { method: 'POST' }); } catch(e){}
                  }} 
                  disabled={isCancelling}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.25rem', background: isCancelling ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.15)', color: isCancelling ? 'var(--text-muted)' : 'var(--accent-red)', border: isCancelling ? 'none' : '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', cursor: isCancelling ? 'not-allowed' : 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                >
                  <X size={18} /> {isCancelling ? 'ĐANG HỦY...' : 'DỪNG LẠI'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

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
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
            <button 
              onClick={() => setReportView('project')}
              style={{ padding: '0.75rem 1.5rem', background: reportView === 'project' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', color: reportView === 'project' ? '#60a5fa' : 'var(--text-muted)', border: reportView === 'project' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Activity size={18} /> BÁO CÁO DỰ ÁN
            </button>
            <button 
              onClick={() => {
                 setReportView('member');
                 if (!selectedMember && data.scores.members && Object.keys(data.scores.members).length > 0) {
                   setSelectedMember(Object.keys(data.scores.members)[0]);
                 }
              }}
              style={{ padding: '0.75rem 1.5rem', background: reportView === 'member' ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: reportView === 'member' ? '#34d399' : 'var(--text-muted)', border: reportView === 'member' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              disabled={!data.scores.members || Object.keys(data.scores.members).length === 0}
            >
              <Users size={18} /> BÁO CÁO THÀNH VIÊN
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
            <div className="glass-card hero-card col-span-4" style={{ borderColor: reportView === 'member' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)' }}>
              <div className="hero-left">
                <div className="metric-label" style={{ fontSize: '1rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {reportView === 'member' ? <><Users size={20} color="#10b981" /> TỔNG QUAN THÀNH VIÊN: {selectedMember}</> : <><Activity size={20} color="#3b82f6" /> TỔNG QUAN DỰ ÁN</>}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '1rem' }}>
                  <div className="metric-value" style={{ 
                    fontSize: '4.5rem',
                    lineHeight: '1',
                    color: (reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)) >= 80 ? 'var(--accent-green)' : (reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)) >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)' 
                  }}>
                    {reportView === 'project' ? data?.scores?.final : (data?.scores?.members?.[selectedMember]?.final || 0)}
                  </div>
                  <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>/ 100</span>
                </div>
                
                {reportView === 'project' && (
                  <div style={{ marginTop: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    XẾP HẠNG: <span className="status-badge" style={{ fontSize: '1.25rem', padding: '0.5rem 1rem' }}>{data.scores.rating}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tổng số dòng Code</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                      {reportView === 'project' ? data?.metrics?.total_loc?.toLocaleString() : (data?.scores?.members?.[selectedMember]?.loc || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{reportView === 'project' ? 'Số lượng tính năng' : 'Nợ kỹ thuật'}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: reportView === 'member' ? 'var(--accent-yellow)' : 'inherit' }}>
                      {reportView === 'project' ? Object.keys(data?.scores?.features || {}).length : `${data?.scores?.members?.[selectedMember]?.debt_mins || 0} phút`}
                    </div>
                  </div>
                </div>

                {/* 4 Trụ cột Dự án / Thành viên */}
                <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', width: '100%' }}>
                  {Object.entries(reportView === 'project' ? (data?.scores?.project_pillars || {}) : (data?.scores?.members?.[selectedMember]?.pillars || {})).map(([pillar, score]) => (
                    <div key={pillar}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{pillar}</span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: getScoreColorClass(score) }}>{score}<span style={{ fontSize: '0.75rem', opacity: 0.6 }}>/10</span></span>
                      </div>
                      <div className="progress-track" style={{ height: '6px', background: 'rgba(255,255,255,0.05)' }}>
                        <div className="progress-fill" style={{ width: `${score * 10}%`, background: getScoreColorClass(score), boxShadow: `0 0 10px ${getScoreColorClass(score)}44` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-right">
                <div style={{ width: '100%', height: '100%', maxWidth: '350px' }}>
                  <Radar 
                    data={memoizedRadarData} 
                    options={chartOptions} 
                  />
                </div>
              </div>
            </div>
            {/* --- END HERO CARD --- */}
            
            {/* DANH SÁCH TÍNH NĂNG */}
            {reportView === 'project' && Object.entries(data.scores.features).map(([name, feat]) => (
                <div key={name} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="metric-label" style={{ color: 'var(--accent-blue)', fontWeight: 'bold', fontSize: '1rem' }}>
                        <FolderOpen size={16} /> {name.toUpperCase()}
                    </div>
                    <div className="metric-value" style={{ fontSize: '2rem', color: getScoreColorClass(feat.final / 10) }}>
                        {feat.final}<span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/100</span>
                    </div>
                    
                    <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* 4 Pillars within feature */}
                        {Object.entries(feat.pillars).map(([pillar, p_score]) => (
                            <div key={pillar} style={{ fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>{pillar}</span>
                                    <span style={{ fontWeight: 600 }}>{p_score}/10</span>
                                </div>
                                <div className="progress-track" style={{ height: '3px' }}>
                                    <div className="progress-fill" style={{ width: `${p_score * 10}%`, backgroundColor: getScoreColorClass(p_score) }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ fontSize: '0.7rem', color: 'var(--text-accent)', fontWeight: 600 }}>
                            DEBT: {feat.debt_mins}m
                         </div>
                         <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {feat.loc.toLocaleString()} LOC
                         </div>
                    </div>
                </div>
            ))}
            
            {/* DANH SÁCH THÀNH VIÊN (MEMBER LEADERBOARD) */}
            {reportView === 'project' && data.scores.members && Object.keys(data.scores.members).length > 0 && (
                <div className="glass-card col-span-4" style={{ marginTop: '0.5rem', animation: 'fadeIn 0.5s ease-out' }}>
                    <div className="metric-label" style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Users size={20} /> BẢNG XẾP HẠNG THÀNH VIÊN (TRONG 6 THÁNG GẦN NHẤT)
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '0.75rem 1rem' }}>Thành viên</th>
                                    <th style={{ padding: '0.75rem 1rem' }}>Tổng LOC</th>
                                    <th style={{ padding: '0.75rem 1rem' }}>Điểm / 100</th>
                                    <th style={{ padding: '0.75rem 1rem' }}>Nợ kỹ thuật</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(data?.scores?.members || {})
                                  .sort((a, b) => (b[1]?.final || 0) - (a[1]?.final || 0))
                                  .map(([author, res], idx) => (
                                    <tr key={author} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600, color: '#e2e8f0' }}>{author}</td>
                                        <td style={{ padding: '1rem', color: '#94a3b8' }}>{res.loc.toLocaleString()} lines</td>
                                        <td style={{ padding: '1rem', color: getScoreColorClass(res.final / 10), fontWeight: 'bold', fontSize: '1.1rem' }}>{res.final}</td>
                                        <td style={{ padding: '1rem', color: 'var(--accent-yellow)' }}>{res.debt_mins} phút</td>
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
            <div className="chart-card">
              <h3 className="chart-title"><Activity size={18} color="var(--accent-blue)" /> Phân Bố Vi Phạm</h3>
              <div className="chart-container">
                {memoizedViolationDistData && <Doughnut data={memoizedViolationDistData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#e2e8f0' } } } }} />}
              </div>
            </div>
            
            <div className="chart-card">
              <h3 className="chart-title"><Shield size={18} color="var(--accent-red)" /> Mức Độ Nghiêm Trọng</h3>
              <div className="chart-container">
                {memoizedSeverityDistData && <Bar data={memoizedSeverityDistData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } }} />}
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
                        <div key={i} className="violation-item" style={{ borderLeftColor: v.weight <= -5 ? 'var(--accent-red)' : v.weight <= -3 ? 'var(--accent-yellow)' : 'var(--accent-blue)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span className="violation-title">{v.reason}</span>
                            <span className={`status-badge ${getSeverityClass(v.weight)}`}>
                              {v.pillar} | {v.weight >= 0 ? `+${v.weight}` : v.weight}
                            </span>
                          </div>
                          <div className="violation-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Search size={12} /> {v.file}{v.line ? `:${v.line}` : ''}
                          </div>
                          {v.snippet && (
                            <pre style={{ 
                              marginTop: '0.75rem', 
                              padding: '0.75rem', 
                              background: 'rgba(0,0,0,0.4)', 
                              borderRadius: '8px', 
                              fontSize: '0.85rem', 
                              overflowX: 'auto',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              <code style={{ color: '#bae6fd' }}>{v.snippet}</code>
                            </pre>
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
    </div>
  );
}

export default App;
