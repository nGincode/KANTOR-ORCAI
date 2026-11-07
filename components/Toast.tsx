"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useOffice } from "@/lib/store";

export function Toast() {
  const toast = useOffice((s) => s.toast);
  const clearToast = useOffice((s) => s.clearToast);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          className="fixed bottom-5 right-5 z-[150] flex w-[320px] items-start gap-2.5 rounded-xl border border-white/15 bg-[#0b1220]/95 p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur"
        >
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
              toast.kind === "error"
                ? "bg-rose-500/15 text-rose-300"
                : toast.kind === "success"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-sky-500/15 text-sky-300"
            }`}
          >
            {toast.kind === "error" ? (
              <AlertCircle size={13} />
            ) : toast.kind === "success" ? (
              <CheckCircle2 size={13} />
            ) : (
              <Info size={13} />
            )}
          </span>
          <p className="flex-1 text-[11px] leading-relaxed text-slate-200">{toast.text}</p>
          <button
            type="button"
            onClick={clearToast}
            className="text-slate-500 transition hover:text-white"
          >
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
