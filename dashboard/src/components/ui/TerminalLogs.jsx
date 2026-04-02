import React, { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';

const TerminalLogs = React.memo(({ isAuditing, jobId }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const logsEndRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    let eventSource;
    if (isAuditing && jobId) {
      setAuditLogs([]);
      eventSource = new EventSource(`/api/audit/jobs/${jobId}/logs`);
      eventSource.onmessage = (e) => {
        if (e.data === '[END_OF_STREAM]') {
            eventSource.close();
            return;
        }
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
  }, [isAuditing, jobId]);

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

export default TerminalLogs;
