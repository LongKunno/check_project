import { useState, useCallback, useRef, useEffect } from 'react';

export const useAuditJob = () => {
    // Các trạng thái của tiến trình Audit
    const [status, setStatus] = useState('idle'); // 'idle' | 'starting' | 'running' | 'completed' | 'failed'
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [message, setMessage] = useState('');
    
    // Sử dụng ref để giữ Timer, ngăn Timer bị kẹt khi Component re-render
    const pollingTimer = useRef(null);

    const clearTimer = () => {
        if (pollingTimer.current) {
            clearInterval(pollingTimer.current);
            pollingTimer.current = null;
        }
    };

    // Dọn dẹp an toàn khi component Unmount (đổi trang hoặc đóng tab)
    useEffect(() => {
        return () => clearTimer();
    }, []);

    // Hàm Polling API kiểm tra trạng thái Job từ máy chủ
    const pollJobStatus = useCallback(async (currentJobId) => {
        try {
            const res = await fetch(`/api/audit/jobs/${currentJobId}`);
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error("Không tìm thấy tiến trình (Job quá hạn hoặc không tồn tại trên Server).");
                }
                throw new Error("Lỗi kết nối khi kiểm tra tiến độ với Backend.");
            }
            
            const data = await res.json();
            
            // Map status từ backend (PENDING, RUNNING) sang UI
            const newStatus = data.status.toLowerCase();
            setStatus(newStatus === 'pending' ? 'starting' : newStatus);
            setMessage(data.message || '');
            
            // Xử lý khi Job đã hoàn tất
            if (data.status === 'COMPLETED') {
                clearTimer();
                setResult(data.result);
            } 
            // Xử lý khi Job gãy gánh (Error)
            else if (data.status === 'FAILED') {
                clearTimer();
                setError(data.message || "Kiểm toán code thất bại do một lỗi hệ thống không xác định.");
            }
        } catch (err) {
            clearTimer();
            setStatus('failed');
            setError(err.message);
        }
    }, []);

    // Hàm mồi bắt đầu Audit (Tự động thích nghi với file Upload hoặc Git URI)
    const startAudit = useCallback(async (payload, isFile = false) => {
        // Khởi tạo và dọn rác trạng thái cũ
        clearTimer();
        setStatus('starting');
        setError(null);
        setResult(null);
        setJobId(null);
        setMessage('Đang khởi tạo kết nối với AI Engine...');

        try {
            const endpoint = isFile ? '/api/audit/process' : '/api/audit/repository';
            const options = { method: 'POST' };
            
            if (isFile) {
                options.body = payload; // Nhận thẳng object FormData từ component
            } else {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(payload);
            }

            // Bắn tín hiệu POST
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `Máy chủ từ chối yêu cầu (Mã lỗi: ${response.status})`);
            }

            const data = await response.json();
            // Backend phải trả về status dạng 'started' hoặc 'accepted' và chứa 'job_id'
            if ((data.status === 'started' || data.status === 'accepted') && data.job_id) {
                const initialJobId = data.job_id;
                setJobId(initialJobId);
                setStatus('running');
                setMessage(data.message || 'Hệ thống AI đã đẩy tác vụ vào hàng đợi nền.');
                
                // Kích nổ hệ thống Long-Polling (cứ 3 giây hỏi Backend 1 lần)
                pollingTimer.current = setInterval(() => {
                    pollJobStatus(initialJobId);
                }, 3000);
            } else {
                throw new Error("Khởi tạo tiến trình nền thất bại: Thuật toán Backend phản hồi sai định dạng chuẩn.");
            }
        } catch (err) {
            setStatus('failed');
            setError(err.message);
        }
    }, [pollJobStatus]);

    // Hàm Dừng thủ công
    const stopAudit = useCallback(() => {
        clearTimer();
        setStatus('idle');
        setMessage('Đã hủy tác vụ kiểm toán theo yêu cầu.');
    }, []);

    return {
        status,       // 'idle' | 'starting' | 'running' | 'completed' | 'failed'
        error,        // Thông báo lỗi nếu thất bại
        result,       // Cấu trúc Data JSON (Scores, Violations, Metrics)
        jobId,        // UUID của Job đang chạy
        message,      // Lời nhắn trực tiếp từ Tiến trình chạy ngầm
        startAudit,   // Trigger action
        stopAudit     // Hủy trigger
    };
};
