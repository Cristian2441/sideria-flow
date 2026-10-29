"use client";

/**
 * Sidebar del Dashboard — Sideria Flow.
 * Con estilos inline de contención estricta para evitar expansiones visuales de SVGs
 * más clases Tailwind CSS para el diseño idéntico a la maqueta.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardNavProps {
  session: {
    userId: string;
    companyId: string;
    name: string;
    email: string;
    role: "REQUESTER" | "MANAGER" | "FINANCE" | string;
  };
  pendingCount: number;
}

export default function DashboardNavigation({
  session,
  pendingCount,
}: DashboardNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const initials =
    session.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const roleLabel =
    session.role === "REQUESTER"
      ? "SOLICITANTE"
      : session.role === "MANAGER"
      ? "JEFATURA"
      : session.role === "FINANCE"
      ? "FINANZAS"
      : "ADMINISTRADOR";

  const navItems = [
    {
      href: "/dashboard",
      label: "Panel principal",
      icon: (
        <svg
          width="20"
          height="20"
          style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, flexShrink: 0 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      isActive: pathname === "/dashboard",
    },
    {
      href: "/dashboard/requests",
      label: "Solicitudes",
      icon: (
        <svg
          width="20"
          height="20"
          style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, flexShrink: 0 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      isActive:
        pathname === "/dashboard/requests" ||
        (pathname.startsWith("/dashboard/requests/") && pathname !== "/dashboard/requests/new"),
    },
  ];

  if (session.role === "MANAGER" || session.role === "FINANCE") {
    navItems.push({
      href: "/dashboard/pending",
      label: "Bandeja pendientes",
      icon: (
        <svg
          width="20"
          height="20"
          style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, flexShrink: 0 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
      isActive: pathname.startsWith("/dashboard/pending"),
    });
  }

  const newRequestActive = pathname === "/dashboard/requests/new";

  return (
    <>
      {/* ── Topbar Móvil (< 768px) ── */}
      <div
        className="md:hidden flex items-center justify-between h-16 px-4 bg-[#071426] text-white border-b border-slate-800 sticky top-0 z-50"
        style={{ height: 64, background: "#071426" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="rounded-lg bg-[#0066ff] flex items-center justify-center text-white"
            style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, background: "#0066ff" }}
          >
            <svg
              width="18"
              height="18"
              style={{ width: 18, height: 18 }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight">Sideria Flow</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white focus:outline-none"
          aria-label="Menú"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Drawer Móvil ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 p-6 flex flex-col justify-between overflow-y-auto"
          style={{ background: "rgba(7, 20, 38, 0.98)", backdropFilter: "blur(8px)" }}
        >
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                  item.isActive
                    ? "bg-[#0066ff] text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
                style={item.isActive ? { background: "#0066ff", color: "#fff" } : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}

            <Link
              href="/dashboard/requests/new"
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                newRequestActive
                  ? "bg-[#0066ff] text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
              style={newRequestActive ? { background: "#0066ff", color: "#fff" } : undefined}
            >
              <svg width="20" height="20" style={{ width: 20, height: 20 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Nueva solicitud</span>
            </Link>
          </nav>

          <div className="pt-6 border-t border-slate-800/80">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="rounded-full flex items-center justify-center font-bold text-xs"
                style={{ width: 38, height: 38, background: "#1e293b", color: "#fff", border: "1px solid #334155" }}
              >
                {initials}
              </div>
              <div>
                <div className="text-sm font-bold text-white">{session.name}</div>
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {roleLabel}
                </div>
              </div>
            </div>
            <a
              href="/api/auth/logout"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
            >
              Cerrar sesión
            </a>
          </div>
        </div>
      )}

      {/* ── Sidebar Escritorio (>= 768px) ── */}
      <aside
        className="hidden md:flex flex-col justify-between sticky top-0 h-screen p-5 z-40 select-none shrink-0"
        style={{
          width: 256,
          minWidth: 256,
          maxWidth: 256,
          height: "100vh",
          background: "#071426",
          color: "#fff",
        }}
      >
        {/* Cabecera y Menú superior */}
        <div className="flex flex-col gap-7">
          {/* Logo Sideria Flow */}
          <Link href="/dashboard" className="flex items-center gap-3 px-2 pt-1 text-decoration-none">
            <div
              className="rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                minHeight: 40,
                background: "#0066ff",
                boxShadow: "0 4px 12px rgba(0, 102, 255, 0.3)",
              }}
            >
              <svg
                width="20"
                height="20"
                style={{ width: 20, height: 20, flexShrink: 0 }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold text-white tracking-tight">
                Sideria Flow
              </span>
              <span
                className="font-bold uppercase tracking-widest text-slate-400 mt-1"
                style={{ fontSize: 9, letterSpacing: "0.14em" }}
              >
                GESTIÓN DE COMPRAS
              </span>
            </div>
          </Link>

          {/* Menú de Navegación */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const activeStyle = item.isActive
                ? {
                    background: "#0066ff",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(0, 102, 255, 0.35)",
                  }
                : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all text-decoration-none ${
                    item.isActive
                      ? "font-bold text-white shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium"
                  }`}
                  style={activeStyle}
                >
                  <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* + Nueva solicitud */}
            <Link
              href="/dashboard/requests/new"
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all text-decoration-none ${
                newRequestActive
                  ? "font-bold text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium"
              }`}
              style={
                newRequestActive
                  ? {
                      background: "#0066ff",
                      color: "#ffffff",
                      boxShadow: "0 4px 14px rgba(0, 102, 255, 0.35)",
                    }
                  : undefined
              }
            >
              <svg
                width="20"
                height="20"
                style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, flexShrink: 0 }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Nueva solicitud</span>
            </Link>
          </nav>
        </div>

        {/* Pie de Sidebar: Perfil de Usuario y Cerrar sesión */}
        <div
          className="pt-4 flex flex-col gap-3"
          style={{ borderTop: "1px solid rgba(51, 65, 85, 0.4)" }}
        >
          <div className="flex items-center gap-3 px-1">
            <div
              className="rounded-full flex items-center justify-center font-bold text-xs shrink-0"
              style={{
                width: 36,
                height: 36,
                minWidth: 36,
                minHeight: 36,
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#fff",
              }}
            >
              {initials}
            </div>
            <div className="flex flex-col overflow-hidden leading-tight">
              <span className="text-sm font-bold text-white truncate">
                {session.name}
              </span>
              <span
                className="font-bold uppercase tracking-wider text-slate-400 mt-0.5"
                style={{ fontSize: 10, letterSpacing: "0.08em" }}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          <a
            href="/api/auth/logout"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800/30 text-decoration-none"
          >
            <svg
              width="16"
              height="16"
              style={{ width: 16, height: 16, flexShrink: 0 }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar sesión</span>
          </a>
        </div>
      </aside>
    </>
  );
}
