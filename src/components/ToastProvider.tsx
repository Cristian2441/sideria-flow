"use client";

/**
 * Sistema de notificaciones Toast para HU-26.
 * Proporciona feedback visual inmediato tras cada acción de usuario.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Si se llama fuera del provider, provee un fallback seguro
    return {
      showToast: (message: string) => {
        console.log("[Toast fallback]:", message);
      },
    };
  }
  return ctx;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠️",
  info: "ℹ️",
};

const TOAST_COLORS: Record<ToastType, { border: string; bg: string; text: string; iconBg: string }> = {
  success: {
    border: "rgba(34,197,94,0.4)",
    bg: "rgba(24, 24, 27, 0.95)",
    text: "#22c55e",
    iconBg: "rgba(34,197,94,0.15)",
  },
  error: {
    border: "rgba(239,68,68,0.4)",
    bg: "rgba(24, 24, 27, 0.95)",
    text: "#ef4444",
    iconBg: "rgba(239,68,68,0.15)",
  },
  warning: {
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(24, 24, 27, 0.95)",
    text: "#f59e0b",
    iconBg: "rgba(245,158,11,0.15)",
  },
  info: {
    border: "rgba(59,92,245,0.4)",
    bg: "rgba(24, 24, 27, 0.95)",
    text: "#5c82f8",
    iconBg: "rgba(59,92,245,0.15)",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-desaparecer en 4 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // También verifica si hay algún toast pendiente guardado en sessionStorage (útil tras redirects)
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("sf_pending_toast");
      if (pending) {
        sessionStorage.removeItem("sf_pending_toast");
        const parsed = JSON.parse(pending) as { message: string; type: ToastType };
        showToast(parsed.message, parsed.type);
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Contenedor flotante de Toasts */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "380px",
          width: "calc(100% - 40px)",
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => {
          const colors = TOAST_COLORS[toast.type];
          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(12px)",
                animation: "toast-slide-in 0.25s ease-out",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: colors.iconBg,
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: "12px",
                    flexShrink: 0,
                  }}
                >
                  {TOAST_ICONS[toast.type]}
                </span>
                <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text)" }}>
                  {toast.message}
                </span>
              </div>

              <button
                type="button"
                aria-label="Cerrar notificación"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: "16px",
                  lineHeight: 1,
                  padding: "4px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Función auxiliar para encolar un Toast que debe mostrarse tras una navegación/redirección.
 */
export function setPendingToast(message: string, type: ToastType = "success") {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("sf_pending_toast", JSON.stringify({ message, type }));
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }
}

