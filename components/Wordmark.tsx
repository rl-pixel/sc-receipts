import type { CSSProperties } from "react";

type Props = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function Wordmark({ size = 14, className = "", style }: Props) {
  return (
    <span
      className={`wordmark ${className}`}
      style={{ fontSize: size, ...style }}
    >
      Studio Chrono
    </span>
  );
}
