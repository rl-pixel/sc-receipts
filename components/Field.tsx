"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Field({ label, hint, prefix, suffix, className = "", ...rest }: Props) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center gap-2 bg-card border border-divider rounded-lg px-3 focus-within:border-ink transition-colors">
        {prefix ? <span className="text-muted text-sm">{prefix}</span> : null}
        <input
          {...rest}
          className={`flex-1 bg-transparent py-3 text-base text-ink placeholder:text-muted/60 outline-none ${className}`}
        />
        {suffix ? <span className="text-muted text-sm">{suffix}</span> : null}
      </div>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
