import { useState, useEffect } from "react";

/**
 * Hook quản lý danh sách repositories và selection.
 * Tách từ App.jsx:L97-156 để giảm LOC và tái sử dụng.
 *
 * Logic:
 * 1. Fetch danh sách repos từ API khi mount
 * 2. Auto-select repo dựa trên audit history gần nhất
 * 3. Fallback: chọn repo đầu tiên trong danh sách
 */
export function useRepositories() {
  const [configuredRepos, setConfiguredRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [repositoriesLoaded, setRepositoriesLoaded] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch("/api/repositories");
        if (response.ok) {
          const result = await response.json();
          if (result.status === "success") {
            setConfiguredRepos(result.data);
            if (result.data.length > 0) {
              setSelectedRepoId((current) => current || result.data[0].id);
            }

            // Cố gắng tìm dự án có lần chấm điểm gần nhất
            try {
              const histRes = await fetch("/api/history");
              if (histRes.ok) {
                const globalHistory = await histRes.json();
                if (globalHistory && globalHistory.length > 0) {
                  const latestAudit = globalHistory[0];
                  const matchedRepo = result.data.find(
                    (r) => r.url === latestAudit.target,
                  );
                  if (matchedRepo) {
                    setSelectedRepoId(matchedRepo.id);
                    return; // Đặt selectedRepoId theo history gần nhất
                  }
                }
              }
            } catch (err) {
              console.error("Failed to fetch global history:", err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch configured repositories:", err);
      } finally {
        setRepositoriesLoaded(true);
      }
    };
    fetchRepos();
  }, []);

  return {
    configuredRepos,
    setConfiguredRepos,
    selectedRepoId,
    setSelectedRepoId,
    repositoriesLoaded,
  };
}
