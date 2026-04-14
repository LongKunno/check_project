import { useState, useRef, useEffect } from "react";
import { useAuditJob } from "./useAuditJob";

/**
 * Hook quản lý toàn bộ state liên quan audit process.
 * Tách từ App.jsx:L194-469 để giảm LOC.
 *
 * Quản lý: data, error, audit status, file upload, history, fix suggestions.
 */
export function useAuditState(selectedRepoId, configuredRepos) {
  // Hook kiểm toán (Background Jobs)
  const {
    status: auditStatus,
    error: auditError,
    result: auditResult,
    jobId,
    message: auditMessage,
    startAudit,
    stopAudit,
  } = useAuditJob();

  const isAuditing = auditStatus === "starting" || auditStatus === "running";

  const [activeTab] = useState("remote"); // 'local' or 'remote'
  const [folderName, setFolderName] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [preparingProgress, setPreparingProgress] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [history, setHistory] = useState([]);
  const [fixingId, setFixingId] = useState(null);
  const [suggestions, setSuggestions] = useState({});
  const [visibleLimit, setVisibleLimit] = useState(50);

  const filesRef = useRef(null);
  const fileInputRef = useRef(null);

  // Đồng bộ kết quả từ Hook sang State
  useEffect(() => {
    if (auditResult) setData(auditResult);
  }, [auditResult]);

  useEffect(() => {
    if (auditError) setError(auditError);
  }, [auditError]);

  // Reset visible limit on data change
  useEffect(() => {
    setVisibleLimit(50);
  }, [data]);

  // Tự động nạp kết quả kiểm toán gần nhất khi thay đổi dự án
  useEffect(() => {
    const loadTargetAudit = async () => {
      let target = null;
      if (activeTab === "remote" && selectedRepoId) {
        const repo = configuredRepos.find((r) => r.id === selectedRepoId);
        if (repo) target = repo.url;
      } else if (activeTab === "local" && folderName) {
        target = folderName;
      }

      if (!target) return;

      try {
        const response = await fetch(
          `/api/history?target=${encodeURIComponent(target)}`,
        );
        if (response.ok) {
          const result = await response.json();
          if (result && result.length > 0) {
            const auditId = result[0].id;
            const detailRes = await fetch(`/api/history/${auditId}`);
            if (detailRes.ok) {
              const detail = await detailRes.json();
              if (detail && detail.full_json) {
                setData(detail.full_json);
                return;
              }
            }
          }
          setData(null);
        }
      } catch (err) {
        console.error("Failed to load target audit:", err);
      }
    };
    loadTargetAudit();
  }, [selectedRepoId, folderName, activeTab, configuredRepos]);

  // Fetch & sync history
  const fetchHistory = async (path) => {
    try {
      const response = await fetch(
        `/api/history?target=${encodeURIComponent(path)}`,
      );
      if (response.ok) {
        const historyData = await response.json();
        setHistory(historyData.reverse());
      }
    } catch (err) {
      console.error("Lỗi lấy lịch sử:", err);
    }
  };

  useEffect(() => {
    if (data?.target) fetchHistory(data.target);
  }, [data]);

  // AI Fix Suggestion
  const fetchFixSuggestion = async (violation) => {
    if (fixingId === violation.id) return;
    setFixingId(violation.id);
    try {
      const res = await fetch("/api/audit/fix-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: violation.file,
          snippet: violation.snippet,
          reason: violation.reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) => ({ ...prev, [violation.id]: data.suggestion }));
      }
    } catch (err) {
      console.error("Fix error:", err);
    } finally {
      setFixingId(null);
    }
  };

  // Folder select handler
  const handleFolderSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    filesRef.current = files;
    setFileCount(files.length);
    setError(null);
    setData(null);
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const name = firstPath.split("/")[0] || "project";
    setFolderName(name);
  };

  // Run audit
  const runAudit = async () => {
    if (activeTab === "remote") {
      if (!selectedRepoId) {
        setError("Please select a project from the list.");
        return;
      }
      setError(null);
      setData(null);
      startAudit({ id: selectedRepoId }, false);
      return;
    }

    const files = filesRef.current;
    if (!files || files.length === 0) {
      setError("Please select a folder to audit.");
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

      for (let i = 0; i < total; i += batchSize) {
        for (let j = i; j < Math.min(i + batchSize, total); j++) {
          const file = files[j];
          formData.append("files", file, file.webkitRelativePath || file.name);
        }
        const currentCount = Math.min(i + batchSize, total);
        const progress = Math.min(
          Math.round((currentCount / total) * 100),
          100,
        );
        setPreparingProgress(progress);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setIsPreparing(false);
      setUploadProgress(100);
      startAudit(formData, true);
    } catch (err) {
      console.error("CHI TIẾT LỖI TẠO UPLOAD:", err);
      setError(err.message);
    } finally {
      setIsPreparing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return {
    // State
    data,
    setData,
    error,
    setError,
    isAuditing,
    jobId,
    auditStatus,
    auditMessage,
    activeTab,
    folderName,
    isCancelling,
    setIsCancelling,
    uploadProgress,
    isPreparing,
    preparingProgress,
    isDragOver,
    setIsDragOver,
    fileCount,
    history,
    fixingId,
    suggestions,
    visibleLimit,
    setVisibleLimit,
    // Refs
    filesRef,
    fileInputRef,
    // Actions
    runAudit,
    stopAudit,
    handleFolderSelect,
    fetchFixSuggestion,
  };
}
