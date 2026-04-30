"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: "sm" | "md" | "lg";
};

export function Field({
  label,
  hint,
  prefix,
  suffix,
  size = "md",
  className = "",
  ...rest
}: Props) {
  const padY = size === "lg" ? "py-3.5" : size === "sm" ? "py-2" : "py-2.5";
  const fontSize = size === "lg" ? "text-lg" : "text-base";
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center gap-2 bg-white border border-divider rounded-lg px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft transition-colors">
        {prefix ? <span className="text-muted text-sm">{prefix}</span> : null}
        <input
          {...rest}
          className={`flex-1 bg-transparent ${padY} ${fontSize} text-ink placeholder:text-muted-soft outline-none ${className}`}
        />
        {suffix ? <span className="text-muted text-sm">{suffix}</span> : null}
      </div>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  rows = 3,
  ...rest
}: {
  label: string;
  hint?: ReactNode;
  rows?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <textarea
        rows={rows}
        {...rest}
        className="bg-white border border-divider rounded-lg px-3 py-2.5 text-base text-ink placeholder:text-muted-soft outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors resize-y"
      />
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
