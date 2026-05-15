import { Link, useLocation } from "wouter";
import {
  Activity,
  Brain,
  Server,
  Shield,
  Workflow,
  Cpu,
  Network,
  FileText,
  Database,
  Sparkles,
  GitBranch,
  Building2,
  Gauge,
  Crosshair,
  Beaker,
  Inbox,
  Users,
  Play,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", path: "/console", icon: Activity },
  { name: "Demo", path: "/demo", icon: Play },
  { name: "Ingestion", path: "/console/ingestion", icon: Inbox },
  { name: "Collaboration", path: "/console/collaboration", icon: Users },
  { name: "Security", path: "/console/security", icon: Shield },
  { name: "Intelligence", path: "/console/intelligence", icon: Sparkles },
  { name: "Cognition", path: "/console/cognition", icon: GitBranch },
  {
    name: "Organization",
    path: "/console/organization-intelligence",
    icon: Building2,
  },
  { name: "Evaluation", path: "/console/evaluation", icon: Gauge },
  { name: "Operations", path: "/console/operations", icon: Crosshair },
  { name: "Benchmarks", path: "/console/benchmarks", icon: Beaker },
  { name: "Agents", path: "/console/agents", icon: Brain },
  { name: "Skills", path: "/console/skills", icon: Cpu },
  { name: "Providers", path: "/console/providers", icon: Server },
  { name: "Workflows", path: "/console/workflows", icon: Workflow },
  { name: "Memory", path: "/console/memory", icon: Database },
  { name: "Candidate Graph", path: "/console/graph/candidate", icon: Network },
  {
    name: "Organization Graph",
    path: "/console/graph/organization",
    icon: Shield,
  },
  { name: "Reports", path: "/console/reports", icon: FileText },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link
            href="/console"
            className="flex items-center gap-2"
          >
            <div className="size-6 rounded bg-primary/20 flex items-center justify-center text-primary border border-primary/50">
              <Network className="size-4" />
            </div>
            <span className="font-mono font-bold text-sm text-foreground tracking-tight">
              R_INT_CONS
            </span>
          </Link>
          <Link
            href="/"
            className="text-[10px] font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            title="Back to public surface"
          >
            <ArrowLeft className="size-3" /> public
          </Link>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
