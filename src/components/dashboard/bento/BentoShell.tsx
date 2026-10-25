import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function BentoShell({ children }: Props) {
  return (
    <div className="bento-root">
      <div className="bento-grid">{children}</div>
    </div>
  );
}
