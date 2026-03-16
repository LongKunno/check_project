import React, { useState, useRef, useEffect } from 'react';
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
  X
} from 'lucide-react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar, Line } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

function App() {
  const [folderName, setFolderName] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [preparingProgress, setPreparingProgress] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const filesRef = useRef(null);
  const fileInputRef = useRef(null);

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
         setError(err.message);
      }
    } finally {
      setIsAuditing(false);
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

  const chartData = data ? {
    labels: ['Performance', 'Maintainability', 'Reliability', 'Security'],
    datasets: [
      {
        label: 'Quality Score',
        data: [
          data.scores.pillars.Performance,
          data.scores.pillars.Maintainability,
          data.scores.pillars.Reliability,
          data.scores.pillars.Security
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointBackgroundColor: '#3b82f6',
      },
    ],
  } : null;

  const chartOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: { color: '#94a3b8', font: { size: 12, weight: '600' } },
        ticks: { display: false, stepSize: 2 },
        suggestedMin: 0,
        suggestedMax: 10
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

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>SOFTWARE AUDIT ENGINE</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Hệ thống Kiểm toán Mã nguồn Tự động (Framework V3)</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Upload Zone */}
          <div
            className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${folderName ? 'has-folder' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              // Drag & drop thư mục qua input file
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

          <button className="btn-audit" onClick={runAudit} disabled={isAuditing || fileCount === 0}>
            {isAuditing ? <Zap className="spin" size={20} /> : <Zap size={20} />}
            {isAuditing 
              ? (isPreparing 
                  ? `CHUẨN BỊ ${preparingProgress}%...`
                  : (uploadProgress > 0 && uploadProgress < 100 
                      ? `ĐANG UPLOAD ${uploadProgress}%...` 
                      : 'ĐANG PHÂN TÍCH...')) 
              : 'CHẠY KIỂM TOÁN'}
          </button>
        </div>
      </header>

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
          {/* Khối các chỉ số tổng quan */}
          <div className="stats-grid">
            <div className="glass-card">
              <div className="metric-label"><Activity size={16} /> ĐIỂM TỔNG QUÁT</div>
              <div className="metric-value" style={{ 
                color: data.scores.final >= 80 ? 'var(--accent-green)' : data.scores.final >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)' 
              }}>
                {data.scores.final}
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>/ 100</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                XẾP HẠNG: <span className="status-badge" style={{ fontSize: '1rem' }}>{data.scores.rating}</span>
              </div>
            </div>
            
            <div className="glass-card">
              <div className="metric-label"><FileSearch size={16} /> QUY MÔ DỰ ÁN</div>
              <div className="metric-value">{data.metrics.total_loc.toLocaleString()}</div>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Dòng code (Lines of Code)</div>
            </div>

            <div className="glass-card">
              <div className="metric-label"><Shield size={16} /> BẢO MẬT & RỦI RO</div>
              <div className="metric-value">
                {data.violations.filter(v => v.pillar === 'Security').length}
              </div>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Vấn đề bảo mật tiềm ẩn</div>
            </div>

            <div className="glass-card">
              <div className="metric-label"><Settings size={16} /> HIỆU NĂNG</div>
              <div className="metric-value">{data.scores.pillars.Performance}/10</div>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Chỉ số tối ưu hóa</div>
            </div>
          </div>

          {/* Biểu đồ xu hướng */}
          {history.length > 1 && (
            <div className="glass-card" style={{ marginBottom: '2.5rem', padding: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem', color: '#94a3b8' }}>
                <Activity size={18} color="var(--accent-blue)" /> XU HƯỚNG SỨC KHỎE DỰ ÁN (HISTORICAL TRENDS)
              </h3>
              <div style={{ height: '220px' }}>
                <Line 
                  data={{
                    labels: history.map(h => new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                    datasets: [{
                      label: 'Audit Score',
                      data: history.map(h => h.score),
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                      pointBackgroundColor: '#3b82f6',
                      pointBorderColor: '#fff',
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8
                      }
                    },
                    scales: {
                      y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                      x: { grid: { display: false }, ticks: { color: '#64748b' } }
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div className="main-grid">
            {/* Danh sách vi phạm chi tiết */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div className="metric-label" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Code2 size={16} /> SỔ CÁI VI PHẠM (VIOLATION LEDGER)</span>
                <span>{data.violations.length} vần đề</span>
              </div>
              
              <div className="violation-list" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {data.violations.map((v, i) => (
                  <div key={i} className="violation-item" style={{ borderLeftColor: v.weight <= -5 ? 'var(--accent-red)' : v.weight <= -3 ? 'var(--accent-yellow)' : 'var(--accent-blue)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="violation-title">{v.reason}</span>
                      <span className={`status-badge ${getSeverityClass(v.weight)}`}>
                        {v.pillar} | {v.weight >= 0 ? `+${v.weight}` : v.weight}
                      </span>
                    </div>
                    <div className="violation-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Search size={12} /> {v.file}
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
                {data.violations.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                    <CheckCircle size={48} style={{ marginBottom: '1rem', color: 'var(--accent-green)', opacity: 0.5 }} />
                    <p>Chúc mừng! Không tìm thấy vi phạm nào. Mã nguồn đạt chuẩn tuyệt đối.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cột bên phải */}
            <div className="sidebar">
              <div className="glass-card">
                <div className="metric-label"><BarChart3 size={16} /> PHÂN BỔ TRỤ CỘT (PILLAR RADAR)</div>
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <Radar data={chartData} options={chartOptions} />
                </div>
              </div>

              <div className="glass-card">
                <div className="metric-label">THÔNG TIN KIỂM TOÁN</div>
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                    <span style={{ fontWeight: 600 }}>{data.project_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Số lượng file:</span>
                    <span>{data.metrics.total_files} files</span>
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
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Trạng thái trống */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', opacity: 0.4 }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <BarChart3 size={80} style={{ color: 'var(--accent-blue)' }} />
            <Upload size={32} style={{ position: 'absolute', bottom: -10, right: -10 }} />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-display)' }}>Sẵn sàng để đánh giá mã nguồn</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Chọn thư mục từ máy tính và nhấn nút <strong>Chạy Kiểm Toán</strong></p>
        </div>
      )}

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
