import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function TopNav({ active }: { active?: "new" | "history" | "settings" }) {
  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-md border-b border-divider">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-ink">
          <Wordmark size={13} />
        </Link>
        <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
          <NavLink href="/" active={active === "new"} label="New" />
          <NavLink href="/history" active={active === "history"} label="History" />
          <NavLink href="/settings" active={active === "settings"} label="Settings" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, active, label }: { href: string; active?: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full transition-colors ${
        active ? "bg-card text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
