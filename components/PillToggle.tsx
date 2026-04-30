"use client";

import type { ReactNode } from "react";

type Option<T> = { value: T; label: ReactNode; disabled?: boolean };

type Props<T extends string> = {
  value: T | null;
  options: Option<T>[];
  onChange: (next: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
};

export function PillToggle<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  ariaLabel,
}: Props<T>) {
  const padY = size === "sm" ? "py-1.5" : "py-2.5";
  const padX = size === "sm" ? "px-3.5" : "px-4";
  const text = size === "sm" ? "text-sm" : "text-sm";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-full bg-divider-soft p-1 border border-divider"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`${padY} ${padX} ${text} rounded-full font-medium transition-colors disabled:opacity-40 ${
              selected
                ? "bg-white text-ink shadow-sm border border-divider"
                : "text-muted hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
