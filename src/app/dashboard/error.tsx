"use client";

/**
 * HU-26: Pantalla de error amigable para el dashboard.
 * Proporciona un mensaje claro, botón para reintentar la acción
 * y alternativa para regresar al panel principal.
 */

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Registrar el error para diagnóstico técnico
    console.error("[DashboardError]:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "14px",
          padding: "36px 32px",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "18px",
        }}
      >
        {/* Ícono de Alerta */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.12)",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
            fontWeight: "bold",
          }}
        >
          ⚠️
        </div>

        <div>
          <h2
            style={{
              fontSize: "19px",
              fontWeight: "700",
              color: "var(--text)",
              margin: "0 0 8px 0",
            }}
          >
            Algo no salió como esperábamos
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--muted)",
              lineHeight: "1.5",
              margin: 0,
            }}
          >
            Ocurrió un problema al procesar la solicitud en esta sección.
            Puedes intentar recargarla nuevamente o volver a la vista principal.
          </p>
        </div>

        {error.digest && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--neutral-400)",
              background: "rgba(255,255,255,0.03)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontFamily: "monospace",
              border: "1px solid var(--border)",
            }}
          >
            Código de referencia: {error.digest}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "12px",
            width: "100%",
            marginTop: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              flex: 1,
              minHeight: "44px",
              padding: "10px 18px",
              borderRadius: "8px",
              background: "var(--brand-500)",
              color: "#fff",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            🔄 Reintentar
          </button>
          <Link
            href="/dashboard"
            style={{
              flex: 1,
              minHeight: "44px",
              padding: "10px 18px",
              borderRadius: "8px",
              background: "var(--neutral-800)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontSize: "13px",
              fontWeight: "500",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

