import React from "react";

/**
 * PageTransition — Instant snap transition
 * Không làm mờ, không đè nội dung cũ, chuyển trang tức thì
 */
export default function PageTransition({ pageKey, children }) {
  return (
    <div key={pageKey} className="flex-1 flex flex-col w-full">
      {children}
    </div>
  );
}
