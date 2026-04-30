import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  filled?: boolean;
};

export function Section({ title, children, filled }: Props) {
  return (
    <section className="flex flex-col gap-3">
      {title ? (
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted font-medium">{title}</h2>
          {filled ? <span aria-label="auto-filled" className="text-success text-sm">✓</span> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
