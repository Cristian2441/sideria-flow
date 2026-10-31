import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Iniciar sesión | Sideria Flow",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#071426] flex items-center justify-center text-slate-400">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
