"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; message: string };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-xs w-full print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md px-4 py-3 text-sm text-white shadow-lg animate-[fadeIn_0.2s_ease-out] ${
              t.type === "success"
                ? "bg-ledger"
                : t.type === "error"
                ? "bg-rust"
                : "bg-ink"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback aman kalau dipakai di luar Provider -- tidak crash, cuma
    // fallback ke console supaya development tetap lancar.
    return {
      showToast: (msg: string) => console.warn("Toast (no provider):", msg),
    };
  }
  return ctx;
}
