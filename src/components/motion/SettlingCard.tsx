import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  className?: string;
  index?: number;
}>;

export default function SettlingCard({ children, className = "", index = 0 }: Props) {
  const [settled, setSettled] = useState(false);
  const offset = useMemo(() => (index % 3) * 3 + 2, [index]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setSettled(true);
      return;
    }
    const timeout = window.setTimeout(() => setSettled(true), 120 + index * 70);
    return () => window.clearTimeout(timeout);
  }, [index]);

  return (
    <div className={`settling-card ${settled ? "is-settled" : ""} ${className}`} style={{ "--settle-x": `${offset}px` } as CSSProperties}>
      {children}
    </div>
  );
}
