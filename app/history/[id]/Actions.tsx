"use client";

import { useState } from "react";

type Props = {
  id: string;
  email: string;
  receiptNumber: string;
};

export function ReceiptDetailActions({ id, email, receiptNumber }: Props) {
  const [copied, setCopied] = useState(false);
  const pdfUrl = `/api/receipts/${id}/pdf`;
  const filename = `StudioChrono_Receipt_${receiptNumber}.pdf`;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // fallback: select-all in a hidden textarea — skipping for brevity
    }
  }

  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      <a
        href={pdfUrl}
        download={filename}
        className="bg-ink text-bg uppercase text-xs tracking-wider px-4 py-2.5 rounded-full"
      >
        Download PDF
      </a>
      <button
        type="button"
        onClick={copyEmail}
        className="bg-card border border-divider text-ink uppercase text-xs tracking-wider px-4 py-2.5 rounded-full hover:border-ink transition-colors"
      >
        {copied ? "Copied ✓" : "Copy email"}
      </button>
    </div>
  );
}
