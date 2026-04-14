import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, loading, authRequired } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0c1222]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Đang xác thực...
          </span>
        </div>
      </div>
    );
  }

  // Nếu auth bị tắt → cho qua (user đã được set thành anonymous bởi AuthContext)
  if (!authRequired) {
    return children;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
