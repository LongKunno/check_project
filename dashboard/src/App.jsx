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
  ChevronRight,
  ChevronLeft,
  Folder,
  X
} from 'lucide-react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

/**
 * Component trình duyệt thư mục (Folder Explorer)
 */
function FolderExplorer({ onSelect, onClose }) {
  const [currentPath, setCurrentPath] = useState('.');
  const [folders, setFolders] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFolders(currentPath);
  }, [currentPath]);

  const fetchFolders = async (path) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/list-dir?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Không thể tải thư mục');
      const data = await response.json();
      setFolders(data.folders);
      setParentPath(data.parent_path);
      setCurrentPath(data.current_path);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="explorer-modal glass-card">
        <div className="explorer-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderOpen size={20} color="var(--accent-blue)" /> Duyệt thư mục
          </h3>
          <button className="btn-browse" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="explorer-content">
          <div className="path-breadcrumb">
             {currentPath}
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>
          ) : (
            <>
              {parentPath && (
                <div className="explorer-item" onClick={() => setCurrentPath(parentPath)}>
                  <ChevronLeft size={18} color="var(--text-muted)" />
                  <span>.. (Thư mục cha)</span>
                </div>
              )}
              {folders.map((folder) => (
                <div key={folder.path} className="explorer-item" onClick={() => setCurrentPath(folder.path)}>
                  <Folder size={18} color="var(--accent-yellow)" />
                  <span>{folder.name}</span>
                  <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </div>
              ))}
              {folders.length === 0 && !parentPath && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không có thư mục nào.
                </div>
              )}
            </>
          )}
        </div>

        <div className="explorer-footer">
          <button className="btn-secondary" onClick={onClose}>HỦY</button>
          <button className="btn-audit" onClick={() => onSelect(currentPath)}>CHỌN THƯ MỤC NÀY</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [targetDir, setTargetDir] = useState('.');
  const [isAuditing, setIsAuditing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showExplorer, setShowExplorer] = useState(false);
  /**
   * Gọi API Backend để kích hoạt quy trình kiểm toán.
   */
  const runAudit = async () => {
    setIsAuditing(true);
    setError(null);
    setData(null); // Reset dữ liệu cũ để tạo hiệu ứng load mới
    try {
      // Gọi đến FastAPI Endpoint qua Vite Proxy (/api)
      const response = await fetch(`/api/audit?target=${encodeURIComponent(targetDir)}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Không thể thực hiện kiểm toán');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  /**
   * Tính toán màu sắc dựa trên trọng số vi phạm.
   */
  const getSeverityClass = (weight) => {
    if (weight <= -5) return 'status-high';    // Lỗi chí mạng
    if (weight <= -3) return 'status-medium';  // Lỗi trung bình
    return 'status-low';                        // Lỗi nhẹ/Gợi ý
  };

  // Cấu hình dữ liệu cho biểu đồ Radar (Pillar Breakdown)
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
      {/* Hiển thị Folder Explorer Modal */}
      {showExplorer && (
        <FolderExplorer 
          onClose={() => setShowExplorer(false)} 
          onSelect={(path) => {
            setTargetDir(path);
            setShowExplorer(false);
          }} 
        />
      )}


      <header>
        <div>
          <h1>SOFTWARE AUDIT ENGINE</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Hệ thống Kiểm toán Mã nguồn Tự động (Framework V3)</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Ô nhập đường dẫn thư mục */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                value={targetDir} 
                onChange={(e) => setTargetDir(e.target.value)}
                placeholder="Đường dẫn thư mục..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  color: 'white',
                  width: '300px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <button className="btn-browse" title="Duyệt thư mục" onClick={() => setShowExplorer(true)}>
              <FolderOpen size={18} />
            </button>
          </div>

          <button className="btn-audit" onClick={runAudit} disabled={isAuditing}>
            {isAuditing ? <Zap className="spin" size={20} /> : <Zap size={20} />}
            {isAuditing ? 'ĐANG QUÉT...' : 'CHẠY KIỂM TOÁN'}
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

            {/* Cột bên phải: Biểu đồ và thông tin Project */}
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
        /* Trạng thái trống (Empty State) */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', opacity: 0.4 }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <BarChart3 size={80} style={{ color: 'var(--accent-blue)' }} />
            <Search size={32} style={{ position: 'absolute', bottom: -10, right: -10 }} />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-display)' }}>Sẵn sàng để đánh giá mã nguồn</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Duyệt thư mục và nhấn nút <strong>Chạy Kiểm Toán</strong></p>
        </div>
      )}

      {/* Animation spins */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { 
          animation: spin 2s linear infinite; 
          color: var(--accent-yellow);
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}

export default App;
