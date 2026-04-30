import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  filled?: boolean;
};

export function Section({ title, children, filled }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-divider pb-2">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted">{title}</h2>
        {filled ? (
          <span aria-label="auto-filled" className="text-success text-xs">
            ✓
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
