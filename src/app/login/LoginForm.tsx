"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

function safeRedirect(path: string | null): string {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\")
  ) {
    return "/dashboard";
  }
  return path;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error?.message ?? "Credenciales inválidas.");
          return;
        }

        // Hard navigation: asegura que el servidor lea la cookie recién seteada
        window.location.href = redirectTo;
      } catch {
        setError("Error de conexión. Inténtalo nuevamente.");
      }
    });
  }

  return (
    <main className="min-h-screen bg-[#071426] flex items-center justify-center p-4 md:p-8 font-sans antialiased selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-[460px] flex flex-col items-center">
        {/* Título exterior */}
        <div className="flex flex-col items-center text-center mb-6">
          <span className="text-3xl font-extrabold tracking-tight text-white">
            Sideria Flow
          </span>
          <span
            className="font-bold uppercase tracking-widest text-slate-400 mt-1"
            style={{ fontSize: 10, letterSpacing: "0.18em" }}
          >
            GESTIÓN DE COMPRAS
          </span>
        </div>

        {/* Rectángulo blanco */}
        <div className="w-full bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10 flex flex-col text-slate-900">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            Inicia sesión
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mb-6 leading-relaxed">
            Accede a tu cuenta para gestionar tus solicitudes de compra.
          </p>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <span className="font-bold">✕</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-[11px] font-bold text-slate-600 tracking-wider uppercase"
              >
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                autoComplete="email"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="text-[11px] font-bold text-slate-600 tracking-wider uppercase"
              >
                Contraseña
              </label>

              <div className="relative flex items-center">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                {/* Botón ojo - toggle visibilidad */}
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer z-10"
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    // Ojo tachado
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    // Ojo abierto
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 bg-[#0066ff] hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 cursor-pointer"
            >
              {isPending ? (
                <span className="flex items-center gap-2 text-xs">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                <>
                  <span className="text-xs md:text-sm">Iniciar sesión</span>
                  <span className="text-sm font-normal">→</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
