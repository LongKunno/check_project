import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, FolderOpen, Code2, AlertTriangle, ChartBar, Loader2 } from 'lucide-react';

const getRatingColor = (rating) => {
  if (!rating) return 'bg-slate-700 text-slate-400 border-slate-600';
  if (rating.startsWith('A')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (rating.startsWith('B')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  if (rating.startsWith('C')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
};

const getScoreGradient = (score) => {
  if (score === null || score === undefined) return 'from-slate-600 to-slate-800';
  if (score >= 90) return 'from-emerald-400 to-teal-500';
  if (score >= 80) return 'from-blue-400 to-indigo-500';
  if (score >= 70) return 'from-amber-400 to-orange-500';
  return 'from-rose-400 to-red-600';
};

const ProjectScoresView = ({ cn }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const res = await fetch('/api/repositories/scores');
        if (!res.ok) throw new Error('Cannot fetch projects scores');
        const data = await res.json();
        if (data.status === 'success') {
          // Sort by score descending (nulls at bottom)
          const sorted = data.data.sort((a, b) => {
            if (a.latest_score === null) return 1;
            if (b.latest_score === null) return -1;
            return b.latest_score - a.latest_score;
          });
          setProjects(sorted);
        } else {
          setError(data.message || 'Error parsing response');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchScores();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="w-full flex-1 p-6 lg:p-8 max-w-7xl mx-auto relative z-10">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold mb-4">
          <ChartBar size={16} />
          Portfolio Overview
        </div>
        <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400" style={{ fontFamily: 'Outfit, sans-serif' }}>
          ĐIỂM SỐ DỰ ÁN
        </h2>
        <p className="text-slate-400 mt-3 font-medium max-w-2xl text-base lg:text-lg">
          Trạng thái và điểm đánh giá gần nhất của tất cả các kho lưu trữ được kết nối với AI Audit Engine.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-slate-400 font-medium animate-pulse">Đang nạp dữ liệu phân tích...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center max-w-lg mx-auto">
          <AlertTriangle className="text-red-400 mx-auto mb-3" size={32} />
          <h3 className="text-red-400 font-bold text-lg mb-2">Lỗi truy xuất dữ liệu</h3>
          <p className="text-slate-300 text-sm">{error}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center p-20 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-xl">
          <FolderOpen size={48} className="text-slate-500 mx-auto mb-4" />
          <h3 className="text-white font-bold text-xl mb-2">Chưa có dự án nào</h3>
          <p className="text-slate-400">Vui lòng cấu hình Repositories trong cấu hình hệ thống.</p>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants} 
          initial="hidden" 
          animate="show" 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {projects.map((project) => (
            <motion.div 
              key={project.id} 
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group relative bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300"
            >
              {/* Card bg gradient hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-xl font-bold text-white truncate mb-1" title={project.name}>{project.name}</h3>
                  <div className="flex items-center text-xs text-slate-400 gap-1.5 font-medium truncate">
                    <Code2 size={12} className="shrink-0" />
                    <span className="truncate" title={project.url}>{project.url.replace('https://', '')}</span>
                  </div>
                </div>
                
                {project.latest_rating ? (
                  <div className={`px-3 py-1.5 rounded-full border shadow-inner flex items-center justify-center font-black text-sm shrink-0 ${getRatingColor(project.latest_rating)}`}>
                    {project.latest_rating}
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-full border shadow-inner flex items-center justify-center font-bold text-xs shrink-0 bg-slate-800/80 text-slate-500 border-slate-700">
                    N/A
                  </div>
                )}
              </div>

              <div className="relative z-10 p-5 rounded-2xl bg-black/40 border border-white/5 shadow-inner flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Audit Score</div>
                  <div className="flex items-baseline gap-1">
                    {project.latest_score !== null ? (
                      <>
                        <span className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br ${getScoreGradient(project.latest_score)}`}>
                          {parseFloat(project.latest_score).toFixed(1)}
                        </span>
                        <span className="text-slate-500 font-bold text-sm">/ 100</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-slate-600">Pending</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                   <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Violations</div>
                   <div className="flex items-center gap-2">
                     <AlertTriangle size={16} className={project.violations_count > 0 ? "text-amber-500" : "text-slate-600"} />
                     <span className="text-xl font-bold text-white">{project.violations_count ?? '-'}</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-white/5 pt-4 relative z-10">
                <div className="flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-400" />
                  <span className="font-semibold">Lần quét cuối:</span>
                </div>
                <span className="font-medium text-slate-300">
                  {project.latest_timestamp 
                    ? new Date(project.latest_timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                    : 'Chưa từng chạy'
                  }
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default ProjectScoresView;
