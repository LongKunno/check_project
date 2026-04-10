import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Global Top Progress Bar
 * Thể hiện quá trình đang thực thi API (Background Fetching)
 */
export default function TopProgressBar({ isFetching }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval;
    if (isFetching) {
      setProgress(15);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + (Math.random() * 5 + 2); // Tăng chậm dần
        });
      }, 300);
    } else {
      setProgress(100);
      const timer = setTimeout(() => {
        setProgress(0);
      }, 400); // Chờ thanh chạy đủ 100% rồi mờ dần
      return () => clearTimeout(timer);
    }
    return () => clearInterval(interval);
  }, [isFetching]);

  return (
    <AnimatePresence>
      {(isFetching || (progress > 0 && progress < 100)) && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.3, duration: 0.4 } }}
        >
          <div className="h-[2px] w-full bg-transparent overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-pink-500 via-indigo-400 to-cyan-400"
              style={{
                boxShadow: "0 0 10px rgba(236, 72, 153, 0.7), 0 0 5px rgba(99, 102, 241, 0.7)"
              }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: isFetching ? 0.3 : 0.2 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
