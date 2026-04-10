import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  enter: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(2px)" },
};

const pageTransition = {
  type: "tween",
  ease: [0.4, 0, 0.2, 1],
  duration: 0.3,
};

/**
 * PageTransition — Wraps page content with smooth enter/exit animation.
 * Use inside <AnimatePresence mode="wait"> keyed by route.
 *
 * @param {string} pageKey — Unique key for the current page (e.g. location.pathname)
 * @param {React.ReactNode} children
 */
export default function PageTransition({ pageKey, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className="flex-1 flex flex-col w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
