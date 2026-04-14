import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

const TOKEN_KEY = "audit_engine_jwt";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(true); // mặc định yêu cầu đăng nhập
  const navigate = useNavigate();

  // On mount: check auth_required config, then verify token if needed
  useEffect(() => {
    const init = async () => {
      try {
        // Step 1: Kiểm tra server có yêu cầu đăng nhập không
        const configRes = await fetch("/api/auth/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          const isAuthRequired = configData.auth_required;
          setAuthRequired(isAuthRequired);

          // Nếu không yêu cầu đăng nhập → bypass, tạo anonymous user
          if (!isAuthRequired) {
            setUser({ email: "anonymous@local", name: "Anonymous", picture: "" });
            setLoading(false);
            return;
          }
        }
      } catch {
        // Nếu không gọi được API config → giữ mặc định auth_required = true
      }

      // Step 2: Verify token nếu auth_required = true
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setToken(savedToken);
        } else {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (googleCredential) => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: googleCredential }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Đăng nhập thất bại");
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    navigate("/project-scores");
  };

  const logout = () => {
    // Nếu auth bị tắt → không redirect login, chỉ tạo lại anonymous user
    if (!authRequired) {
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    navigate("/login");
  };

  // Anonymous user check: user có email anonymous@local
  const isAnonymous = user?.email === "anonymous@local";

  /**
   * Cập nhật authRequired runtime (khi user thay đổi từ Settings UI).
   * Nếu tắt auth → tự động tạo anonymous user để không bị redirect.
   */
  const updateAuthRequired = (newValue) => {
    setAuthRequired(newValue);
    if (!newValue && !user) {
      setUser({ email: "anonymous@local", name: "Anonymous", picture: "" });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authRequired, isAnonymous, login, logout, updateAuthRequired }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
