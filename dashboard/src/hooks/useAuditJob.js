import { useState, useCallback, useRef, useEffect } from "react";

export const useAuditJob = () => {
  // Các trạng thái của tiến trình Audit
  const [status, setStatus] = useState("idle"); // 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(null);
  const [cancelRequested, setCancelRequested] = useState(false);

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
          throw new Error(
            "Job not found (expired or does not exist on the server).",
          );
        }
        throw new Error("Connection error while checking job status.");
      }

      const data = await res.json();

      // Map status từ backend (PENDING, RUNNING) sang UI
      const newStatus = data.status.toLowerCase();
      setStatus(newStatus === "pending" ? "starting" : newStatus);
      setMessage(data.message || "");
      setProgress(data.progress || null);
      setCancelRequested(Boolean(data.cancel_requested));

      // Xử lý khi Job đã hoàn tất
      if (data.status === "COMPLETED") {
        clearTimer();
        setResult(data.result);
      }
      else if (data.status === "CANCELLED") {
        clearTimer();
        setResult(null);
        setError(null);
      }
      // Xử lý khi Job gãy gánh (Error)
      else if (data.status === "FAILED") {
        clearTimer();
        setError(
          data.message || "Code audit failed due to an unknown system error.",
        );
      }

      return data;
    } catch (err) {
      clearTimer();
      setStatus("failed");
      setError(err.message);
      setProgress(null);
      return null;
    }
  }, []);

  // Hàm mồi bắt đầu Audit (Tự động thích nghi với file Upload hoặc Git URI)
  const startAudit = useCallback(
    async (payload, isFile = false) => {
      // Khởi tạo và dọn rác trạng thái cũ
      clearTimer();
      setStatus("starting");
      setError(null);
      setResult(null);
      setJobId(null);
      setMessage("Initializing connection to AI Engine...");
      setProgress(null);
      setCancelRequested(false);

      try {
        const endpoint = isFile
          ? "/api/audit/process"
          : "/api/audit/repository";
        const options = { method: "POST" };

        if (isFile) {
          options.body = payload; // Nhận thẳng object FormData từ component
        } else {
          options.headers = { "Content-Type": "application/json" };
          options.body = JSON.stringify(payload);
        }

        // Bắn tín hiệu POST
        const response = await fetch(endpoint, options);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.detail ||
              `Server rejected the request (Error code: ${response.status})`,
          );
        }

        const data = await response.json();
        // Backend phải trả về status dạng 'started' hoặc 'accepted' và chứa 'job_id'
        if (
          (data.status === "started" || data.status === "accepted") &&
          data.job_id
        ) {
          const initialJobId = data.job_id;
          setJobId(initialJobId);
          setStatus("running");
          setMessage(
            data.message || "AI system has queued the task in the background.",
          );
          const initialStatus = await pollJobStatus(initialJobId);

          // Kích nổ hệ thống Long-Polling (cứ 3 giây hỏi Backend 1 lần)
          if (
            initialStatus &&
            initialStatus.status !== "COMPLETED" &&
            initialStatus.status !== "FAILED" &&
            initialStatus.status !== "CANCELLED"
          ) {
            pollingTimer.current = setInterval(() => {
              pollJobStatus(initialJobId);
            }, 3000);
          }
        } else {
          throw new Error(
            "Background job initialization failed: backend returned an invalid response format.",
          );
        }
      } catch (err) {
        setStatus("failed");
        setError(err.message);
      }
    },
    [pollJobStatus],
  );

  // Hàm Dừng thủ công
  const stopAudit = useCallback(() => {
    clearTimer();
    setStatus("idle");
    setMessage("Audit task cancelled on request.");
    setProgress(null);
    setCancelRequested(false);
  }, []);

  const cancelAudit = useCallback(
    async (currentJobId) => {
      if (!currentJobId) return false;
      try {
        const response = await fetch(`/api/audit/jobs/${currentJobId}/cancel`, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Failed to request job cancellation.");
        }
        const data = await response.json();
        setCancelRequested(true);
        if (data.message) setMessage(data.message);
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                last_detail: data.message || prev.last_detail,
              }
            : prev,
        );
        await pollJobStatus(currentJobId);
        return data;
      } catch (err) {
        setError(err.message);
        return null;
      }
    },
    [pollJobStatus],
  );

  return {
    status, // 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
    error, // Thông báo lỗi nếu thất bại
    result, // Cấu trúc Data JSON (Scores, Violations, Metrics)
    jobId, // UUID của Job đang chạy
    message, // Lời nhắn trực tiếp từ Tiến trình chạy ngầm
    progress, // Structured progress từ JobStatus API
    cancelRequested,
    startAudit, // Trigger action
    stopAudit, // Hủy trigger
    cancelAudit,
  };
};
