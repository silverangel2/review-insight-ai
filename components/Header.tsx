import Link from "next/link";
import { AccountNav } from "@/components/AccountNav";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/analyze", label: "Analyzer" },
  { href: "/compare", label: "Compare" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reviews", label: "Reviews" },
  { href: "/about", label: "About" }
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-cyan-100/70 bg-white/88 shadow-[0_12px_40px_rgba(8,183,168,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_52%,#ffb238)] text-sm font-black text-white shadow-glow">RI</span>
          <span className="bg-[linear-gradient(135deg,#172033,#2356a3,#08b7a8)] bg-clip-text text-base font-black tracking-tight text-transparent dark:from-white dark:via-cyan-100 dark:to-amber">ReviewIntel</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-ink dark:hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/analyze"
            className="hidden rounded-xl bg-[linear-gradient(135deg,#2356a3,#08b7a8)] px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:scale-[1.02] hover:shadow-glow sm:inline-flex"
          >
            Analyze
          </Link>
          <AccountNav />
        </div>
      </div>
    </header>
  );
}
