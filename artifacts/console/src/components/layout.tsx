import { Link, useLocation } from "wouter";
import { Activity, Brain, Server, Shield, Workflow, Cpu, Network, FileText, Database, Sparkles, GitBranch, Building2, Gauge, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", path: "/", icon: Activity },
  { name: "Intelligence", path: "/intelligence", icon: Sparkles },
  { name: "Cognition", path: "/cognition", icon: GitBranch },
  { name: "Organization", path: "/organization-intelligence", icon: Building2 },
  { name: "Evaluation", path: "/evaluation", icon: Gauge },
  { name: "Operations", path: "/operations", icon: Crosshair },
  { name: "Agents", path: "/agents", icon: Brain },
  { name: "Skills", path: "/skills", icon: Cpu },
  { name: "Providers", path: "/providers", icon: Server },
  { name: "Workflows", path: "/workflows", icon: Workflow },
  { name: "Memory", path: "/memory", icon: Database },
  { name: "Candidate Graph", path: "/graph/candidate", icon: Network },
  { name: "Organization Graph", path: "/graph/organization", icon: Shield },
  { name: "Reports", path: "/reports", icon: FileText },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-primary/20 flex items-center justify-center text-primary border border-primary/50">
              <Network className="size-4" />
            </div>
            <span className="font-mono font-bold text-sm text-foreground tracking-tight">R_INT_CONS</span>
          </div>
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
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
