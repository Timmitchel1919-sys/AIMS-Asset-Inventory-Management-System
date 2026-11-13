/**
 * Route-aware skeleton screens.
 *
 * `pickSkeleton(pathname)` returns the skeleton that best matches the route
 * about to render (dashboard / assets / default list / module card).
 */
import type { ReactNode } from "react";

const Bar = ({ w, h = 14, className = "" }: { w: string; h?: number; className?: string }) => (
  <span
    className={`aims-skeleton-bar ${className}`}
    style={{ width: w, height: h, borderRadius: Math.min(h / 2, 8) }}
  />
);

function SkeletonFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="aims-skeleton"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonFrame label="Loading dashboard">
      <div className="aims-skeleton-row aims-skeleton-row--spread" style={{ marginBottom: 20 }}>
        <Bar w="180px" h={26} />
        <Bar w="120px" h={32} />
      </div>
      <div className="aims-skeleton-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aims-skeleton-card" style={{ minHeight: 110 }}>
            <Bar w="60%" h={12} />
            <Bar w="40%" h={28} />
            <Bar w="80%" h={10} />
          </div>
        ))}
      </div>
      <div className="aims-skeleton-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="aims-skeleton-card" style={{ minHeight: 280 }}>
          <Bar w="30%" h={16} />
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 10, marginTop: 20 }}>
            {[55, 72, 40, 90, 60, 48, 85, 70].map((h, i) => (
              <span key={i} className="aims-skeleton-bar" style={{ width: 24, height: `${h}%`, borderRadius: 4 }} />
            ))}
          </div>
        </div>
        <div className="aims-skeleton-card" style={{ minHeight: 280 }}>
          <Bar w="50%" h={16} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aims-skeleton-row" style={{ gap: 10, marginTop: 10 }}>
              <span className="aims-skeleton-bar" style={{ width: 28, height: 28, borderRadius: 999 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <Bar w="70%" h={10} />
                <Bar w="40%" h={8} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function AssetsSkeleton() {
  return (
    <SkeletonFrame label="Loading assets">
      <div className="aims-skeleton-row aims-skeleton-row--spread" style={{ marginBottom: 16 }}>
        <Bar w="180px" h={26} />
        <Bar w="60%" h={38} className="aims-skeleton-bar--pill" />
      </div>
      <div className="aims-skeleton-row" style={{ gap: 10, marginBottom: 16 }}>
        <Bar w="110px" h={34} />
        <Bar w="110px" h={34} />
        <Bar w="110px" h={34} />
        <Bar w="110px" h={34} />
        <Bar w="140px" h={34} />
      </div>
      <div className="aims-skeleton-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="aims-skeleton-row" style={{ gap: 12, padding: "12px 16px", background: "var(--color-background-secondary)" }}>
          {Array.from({ length: 7 }).map((_, i) => <Bar key={i} w={`${8 + i * 2}%`} h={10} />)}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aims-skeleton-row" style={{ gap: 12, padding: "14px 16px", borderTop: "1px solid var(--color-border)" }}>
            <Bar w="60px" h={14} />
            <Bar w="140px" h={14} />
            <Bar w="80px" h={14} />
            <Bar w="120px" h={14} />
            <Bar w="100px" h={14} />
            <Bar w="90px" h={14} />
            <Bar w="70px" h={18} className="aims-skeleton-bar--pill" />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function ListSkeleton() {
  return (
    <SkeletonFrame label="Loading">
      <div className="aims-skeleton-row aims-skeleton-row--spread" style={{ marginBottom: 16 }}>
        <Bar w="180px" h={26} />
        <Bar w="120px" h={32} />
      </div>
      <div className="aims-skeleton-card" style={{ padding: 0 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aims-skeleton-row" style={{ gap: 12, padding: "14px 16px", borderTop: i ? "1px solid var(--color-border)" : "0" }}>
            <Bar w="70px" h={14} />
            <Bar w="200px" h={14} />
            <Bar w="120px" h={14} />
            <Bar w="90px" h={14} />
            <Bar w="60px" h={18} className="aims-skeleton-bar--pill" />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function ModuleSkeleton() {
  return (
    <SkeletonFrame label="Loading module">
      <Bar w="220px" h={26} />
      <div className="aims-skeleton-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aims-skeleton-card" style={{ minHeight: 140 }}>
            <Bar w="70%" h={14} />
            <Bar w="40%" h={10} />
            <Bar w="60%" h={10} />
            <div style={{ marginTop: "auto" }}>
              <Bar w="40%" h={10} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function pickSkeleton(pathname: string) {
  const path = (pathname || "").toLowerCase();
  if (path === "/" || path.startsWith("/dashboard")) return <DashboardSkeleton />;
  if (path.startsWith("/assets")) return <AssetsSkeleton />;
  if (
    path.startsWith("/inventory") ||
    path.startsWith("/movements") ||
    path.startsWith("/history") ||
    path.startsWith("/users") ||
    path.startsWith("/notifications") ||
    path.startsWith("/departments") ||
    path.startsWith("/locations")
  )
    return <ListSkeleton />;
  return <ModuleSkeleton />;
}
