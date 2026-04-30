import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function TopNav({
  active,
}: {
  active?: "new" | "history" | "payouts" | "settings";
}) {
  return (
    <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-md border-b border-divider">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:h-14">
          <div className="h-12 sm:h-auto flex items-center">
            <Link href="/" className="text-ink">
              <Wordmark size={13} />
            </Link>
          </div>
          <nav className="-mx-1 px-1 overflow-x-auto sm:overflow-visible sm:mx-0 sm:px-0">
            <div className="flex items-center gap-1 pb-2 sm:pb-0">
              <NavLink href="/" active={active === "new"} label="New" />
              <NavLink href="/history" active={active === "history"} label="History" />
              <NavLink href="/payouts" active={active === "payouts"} label="Payouts" />
              <NavLink href="/settings" active={active === "settings"} label="Settings" />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, active, label }: { href: string; active?: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors ${
        active
          ? "bg-ink text-bg"
          : "text-muted hover:text-ink hover:bg-divider-soft"
      }`}
    >
      {label}
    </Link>
  );
}
