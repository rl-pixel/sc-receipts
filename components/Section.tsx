import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  filled?: boolean;
};

export function Section({ title, children, filled }: Props) {
  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
            {title}
          </h2>
          {filled ? (
            <span aria-label="auto-filled" className="text-success text-xs">
              ✓
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}
