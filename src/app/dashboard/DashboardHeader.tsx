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
     
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-slate-500" style={{ color: "#64748b", margin: 0 }}>
          Gestión de solicitudes de compra
        </h2>
      </div>

      <div className="flex items-center gap-3">
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
    </header>
  );
}
