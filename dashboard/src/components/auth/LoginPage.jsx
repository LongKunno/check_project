import React, { useState } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Shield, AlertTriangle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const LoginPage = () => {
  const { user, loading, login } = useAuth();
  const [error, setError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Already logged in → redirect
  if (!loading && user) {
    return <Navigate to="/project-scores" replace />;
  }

  const handleSuccess = async (credentialResponse) => {
    setError(null);
    setIsLoggingIn(true);
    try {
      await login(credentialResponse.credential);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleError = () => {
    setError("Google Sign-In thất bại. Vui lòng thử lại.");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 overflow-hidden">
      {/* ── Aurora background effects ── */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vh] rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-[-15%] right-[-5%] w-[50vw] h-[50vh] rounded-full opacity-15 blur-[100px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-[30%] right-[20%] w-[30vw] h-[30vh] rounded-full opacity-10 blur-[80px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)",
        }}
      />

      {/* ── Login Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
          {/* Top accent line */}
          <div className="h-[2px] bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-500" />

          <div className="p-10 flex flex-col items-center gap-8">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
              className="flex flex-col items-center gap-4"
            >
              <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-4 rounded-2xl shadow-md">
                <Shield size={40} className="text-white" />
              </div>
              <div className="text-center">
                <h1
                  className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-violet-600"
                  style={{ fontFamily: "Outfit" }}
                >
                  AUDIT ENGINE
                </h1>
                <span className="text-[10px] uppercase font-bold text-violet-400 tracking-[4px] bg-violet-500/10 px-2.5 py-0.5 rounded-full mt-1 inline-block">
                  Framework V{import.meta.env.VITE_APP_VERSION || "1.0.0"}
                </span>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <p className="text-slate-500 text-sm leading-relaxed">
                AI-Powered Static Analysis
                <br />
                <span className="text-slate-400">Code Quality Platform</span>
              </p>
            </motion.div>

            {/* Google Login Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full flex flex-col items-center gap-4"
            >
              {isLoggingIn ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-500 font-medium">
                    Đang xác thực...
                  </span>
                </div>
              ) : (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleSuccess}
                    onError={handleError}
                    theme="outline"
                    shape="pill"
                    size="large"
                    width="300"
                    text="signin_with"
                    logo_alignment="left"
                  />
                </div>
              )}

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2.5"
                >
                  <AlertTriangle
                    size={16}
                    className="text-rose-500 shrink-0 mt-0.5"
                  />
                  <span className="text-rose-600 text-xs font-medium leading-relaxed">
                    {error}
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Footer note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-[10px] text-slate-600 text-center uppercase tracking-widest"
            >
              Chỉ tài khoản được ủy quyền mới có thể truy cập
            </motion.p>
          </div>
        </div>

        {/* Bottom label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mt-6 text-[10px] text-slate-600 tracking-wider"
        >
          Powered by Google OAuth 2.0
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
