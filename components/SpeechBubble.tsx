"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface SpeechBubbleProps {
  text: string;
  color: string;
  name?: string;
  role?: string;
  className?: string;
}

export function SpeechBubble({ text, color, name, role, className = "" }: SpeechBubbleProps) {
  const [visible, setVisible] = useState("");
  const thinking = text === "..." || text === "";

  useEffect(() => {
    if (thinking) {
      setVisible("");
      return;
    }
    let index = 0;
    setVisible("");
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 20);
    return () => window.clearInterval(timer);
  }, [text, thinking]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className={`pointer-events-none relative w-[224px] rounded-[18px] border border-slate-200/70 bg-white/85 px-3 py-2.5 text-left shadow-[0_16px_34px_-12px_rgba(2,6,23,0.65)] backdrop-blur-md ${className}`}
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-1.5 border-b border-slate-100 pb-1">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}22` }}
        />
        <span className="truncate text-[9.5px] font-black leading-none text-slate-700">
          {name ?? "Rekan tim"}
        </span>
        {role && (
          <span className="truncate text-[8px] font-semibold leading-none text-slate-400">
            · {role}
          </span>
        )}
      </div>
      <p className="text-[11.5px] leading-[1.45] font-medium text-slate-800">
        {thinking ? (
          <span className="flex items-center gap-1 py-0.5 text-slate-400">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-slate-400"
                animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
            <span className="ml-1 text-[10px]">berpikir</span>
          </span>
        ) : (
          <>
            {visible}
            {visible.length < text.length && (
              <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-slate-500 align-middle" />
            )}
          </>
        )}
      </p>
      <div
        className="absolute -bottom-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-slate-200/70 bg-white/85"
        aria-hidden
      />
    </motion.div>
  );
}
