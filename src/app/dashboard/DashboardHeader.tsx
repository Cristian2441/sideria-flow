"use client";

/**
 * Topbar del Dashboard — Sideria Flow.
 * Cabecera blanca con breadcrumb, notificaciones y perfil de usuario con contención de dimensiones.
 */

import Link from "next/link";

interface DashboardHeaderProps {
  session: {
    userId: string;
    companyId: string;
    name: string;
    email: string;
    role: "REQUESTER" | "MANAGER" | "FINANCE" | string;
  };
  pendingCount?: number;
}

export default function DashboardHeader({
  session,
  pendingCount = 5,
}: DashboardHeaderProps) {
  const initials =
    session.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const roleDisplay =
    session.role === "REQUESTER"
      ? "Solicitante"
      : session.role === "MANAGER"
      ? "Jefatura"
      : session.role === "FINANCE"
      ? "Finanzas"
      : "Administrador";

  return (
    <header
      className="h-16 px-6 md:px-8 flex items-center justify-between sticky top-0 z-30"
      style={{
        height: 64,
        minHeight: 64,
        background: "#ffffff",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      {/* Título de sección / Breadcrumb */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-slate-500" style={{ color: "#64748b", margin: 0 }}>
          Gestión de solicitudes de compra
        </h2>
      </div>

      {/* Herramientas derechas */}
      <div className="flex items-center gap-4">
        {/* Lupa de búsqueda */}
        <button
          type="button"
          aria-label="Buscar"
          className="rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ width: 36, height: 36, background: "transparent", border: "none" }}
        >
          <svg
            width="18"
            height="18"
            style={{ width: 18, height: 18, flexShrink: 0 }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Campana de Notificaciones con Badge Rojo */}
        <Link
          href="/dashboard/pending"
          aria-label="Notificaciones"
          className="relative rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          style={{ width: 36, height: 36 }}
        >
          <svg
            width="20"
            height="20"
            style={{ width: 20, height: 20, flexShrink: 0 }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span
            className="absolute top-1 right-1 text-white font-bold rounded-full flex items-center justify-center leading-none"
            style={{
              width: 16,
              height: 16,
              fontSize: 10,
              background: "#ef4444",
              boxShadow: "0 2px 4px rgba(239, 68, 68, 0.4)",
            }}
          >
            {pendingCount > 0 ? pendingCount : 5}
          </span>
        </Link>

        {/* Separador vertical sutil */}
        <div className="h-6 w-px bg-slate-100 hidden sm:block" style={{ width: 1, height: 24, background: "#f1f5f9" }} />

        {/* Perfil del Usuario actual */}
        <div className="flex items-center gap-3 pl-1">
          <div
            className="rounded-full flex items-center justify-center font-bold text-xs tracking-wider shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "#071426",
              color: "#ffffff",
              border: "1px solid #1e293b",
            }}
          >
            {initials}
          </div>
          <div className="hidden sm:flex flex-col text-left leading-tight">
            <span className="text-xs font-bold text-slate-900" style={{ color: "#0f172a" }}>
              {session.name}
            </span>
            <span className="text-[11px] text-slate-500 font-normal" style={{ color: "#64748b" }}>
              {roleDisplay}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
