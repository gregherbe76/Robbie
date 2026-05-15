import { Link, useLocation } from "wouter";
import { Network, ExternalLink, ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { name: "Why", path: "/why" },
  { name: "Architecture", path: "/architecture" },
  { name: "Lab", path: "/lab" },
  { name: "Demo", path: "/demo" },
  { name: "Benchmarks", path: "/benchmarks-public" },
  { name: "API", path: "/api-explorer" },
  { name: "Docs", path: "/docs" },
];

/**
 * Marketing layout for the public surface. Clean, narrow, no sidebar.
 * The operator console lives behind `/console/*` and uses `Layout`.
 */
export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    // Fire-and-forget pageview event. Privacy-safe: only the path
    // string is incremented as a counter; no IDs, no PII.
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/analytics/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `view:${location}` }),
    }).catch(() => {});
  }, [location]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-mono font-bold tracking-tight"
          >
            <div className="size-6 rounded bg-primary/15 flex items-center justify-center text-primary border border-primary/40">
              <Network className="size-3.5" />
            </div>
            <span>R_INT_CONS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active =
                location === n.path ||
                (n.path !== "/" && location.startsWith(n.path));
              return (
                <Link
                  key={n.path}
                  href={n.path}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n.name}
                </Link>
              );
            })}
            <Link
              href="/console"
              className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors"
            >
              Console <ArrowUpRight className="size-3.5" />
            </Link>
          </nav>
        </div>
        {/* Mobile nav: compact strip */}
        <nav className="md:hidden flex gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 text-xs">
          {NAV.map((n) => (
            <Link
              key={n.path}
              href={n.path}
              className={cn(
                "shrink-0 rounded px-2.5 py-1 font-medium",
                location === n.path
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground",
              )}
            >
              {n.name}
            </Link>
          ))}
          <Link
            href="/console"
            className="shrink-0 rounded px-2.5 py-1 font-medium text-muted-foreground"
          >
            Console
          </Link>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/70 mt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2 text-foreground font-mono font-bold">
              <Network className="size-4 text-primary" /> R_INT_CONS
            </div>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              Deterministic recruiting intelligence infrastructure. Open source.
              Provenance-first. Calibration-aware. Not an ATS.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
              Product
            </div>
            <FooterLink href="/demo">Live demo</FooterLink>
            <FooterLink href="/benchmarks-public">Benchmarks</FooterLink>
            <FooterLink href="/architecture">Architecture</FooterLink>
            <FooterLink href="/api-explorer">API</FooterLink>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
              Developers
            </div>
            <FooterLink href="/docs">Docs</FooterLink>
            <FooterLink href="/console">Operator console</FooterLink>
            <a
              href="https://github.com"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        <div className="border-t border-border/60 py-4 text-center text-[11px] text-muted-foreground font-mono">
          Same input → same bytes. Every time.
        </div>
      </footer>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block text-muted-foreground hover:text-foreground"
    >
      {children}
    </Link>
  );
}
