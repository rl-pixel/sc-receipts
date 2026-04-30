"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
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
}: FieldProps) {
  const padY = size === "lg" ? "py-3.5" : size === "sm" ? "py-2" : "py-2.5";
  const fontSize = size === "lg" ? "text-lg" : "text-base";
  return (
    <label className="flex flex-col gap-1.5">
      {label ? <span className="text-sm text-muted">{label}</span> : null}
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

export function LineInput({
  prefix,
  suffix,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode; suffix?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-divider focus-within:border-accent transition-colors">
      {prefix ? <span className="text-muted-soft text-base">{prefix}</span> : null}
      <input
        {...rest}
        className={`flex-1 bg-transparent py-2 text-base text-ink placeholder:text-muted-soft outline-none ${className}`}
      />
      {suffix ? <span className="text-muted-soft text-sm">{suffix}</span> : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: ReactNode;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {label ? <span className="text-sm text-muted">{label}</span> : null}
      <textarea
        rows={rows}
        {...rest}
        className="bg-white border border-divider rounded-lg px-3 py-2.5 text-base text-ink placeholder:text-muted-soft outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors resize-y"
      />
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
