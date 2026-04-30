import Link from "next/link";
import {
  ReceiptText,
  Clock,
  Wallet,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

type Active = "new" | "history" | "payouts" | "settings";

const TABS: {
  href: string;
  active: Active;
  label: string;
  Icon: LucideIcon;
}[] = [
  { href: "/", active: "new", label: "New", Icon: ReceiptText },
  { href: "/history", active: "history", label: "History", Icon: Clock },
  { href: "/payouts", active: "payouts", label: "Payouts", Icon: Wallet },
  { href: "/settings", active: "settings", label: "Settings", Icon: SettingsIcon },
];

export function BottomNav({ active }: { active?: Active }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 sm:hidden bg-white/95 backdrop-blur-md border-t border-divider pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {TABS.map((t) => {
          const isActive = active === t.active;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                isActive ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              <t.Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span
                className={`text-[10px] tracking-wide ${isActive ? "font-semibold" : "font-medium"}`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
