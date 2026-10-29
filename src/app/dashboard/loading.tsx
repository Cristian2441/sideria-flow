/**
 * HU-26: Estado de carga elegante con efecto shimmer para el dashboard.
 */

export default function DashboardLoading() {
  return (
    <div
      style={{
        padding: "32px",
        maxWidth: "1200px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes sf-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.75; }
        }
        .skeleton-pulse {
          animation: sf-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 6px;
        }
      `}</style>

      {/* Header Skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "28px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="skeleton-pulse" style={{ width: "220px", height: "28px" }} />
          <div className="skeleton-pulse" style={{ width: "340px", height: "16px" }} />
        </div>
        <div className="skeleton-pulse" style={{ width: "160px", height: "42px", borderRadius: "8px" }} />
      </div>

      {/* Filters Bar Skeleton */}
      <div
        className="skeleton-pulse"
        style={{
          width: "100%",
          height: "64px",
          borderRadius: "10px",
          marginBottom: "24px",
        }}
      />

      {/* Content / Table Rows Skeleton */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Table Header Placeholder */}
        <div
          className="skeleton-pulse"
          style={{ width: "100%", height: "24px", opacity: 0.2 }}
        />

        {/* 5 Row Placeholders */}
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              padding: "12px 0",
              borderBottom: idx < 5 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 2 }}>
              <div className="skeleton-pulse" style={{ width: "70%", height: "16px" }} />
              <div className="skeleton-pulse" style={{ width: "40%", height: "12px" }} />
            </div>
            <div className="skeleton-pulse" style={{ width: "100px", height: "24px", borderRadius: "12px" }} />
            <div className="skeleton-pulse" style={{ width: "90px", height: "16px" }} />
            <div className="skeleton-pulse" style={{ width: "70px", height: "32px", borderRadius: "6px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

