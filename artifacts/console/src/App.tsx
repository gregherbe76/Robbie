import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { MarketingLayout } from "@/components/marketing-layout";

// Console pages (operator surface, live under /console/*)
import { Overview } from "@/pages/overview";
import { Agents } from "@/pages/agents";
import { Skills } from "@/pages/skills";
import { Providers } from "@/pages/providers";
import { Workflows } from "@/pages/workflows";
import { Memory } from "@/pages/memory";
import { Reports } from "@/pages/reports";
import { Intelligence } from "@/pages/intelligence";
import { Cognition } from "@/pages/cognition";
import { OrganizationIntelligence } from "@/pages/organization-intelligence";
import { Evaluation } from "@/pages/evaluation";
import { Operations } from "@/pages/operations";
import { Benchmarks } from "@/pages/benchmarks";
import { Ingestion } from "@/pages/ingestion";
import { Collaboration } from "@/pages/collaboration";
import { Security } from "@/pages/security";
import { CandidateGraph } from "@/pages/graph/candidate";
import { OrganizationGraph } from "@/pages/graph/organization";

// Public marketing pages
import { Landing } from "@/pages/public/landing";
import { Why } from "@/pages/public/why";
import { Architecture } from "@/pages/public/architecture";
import { BenchmarksPublic } from "@/pages/public/benchmarks-public";
import { Docs } from "@/pages/public/docs";
import { ApiExplorer } from "@/pages/public/api-explorer";

// Demo + replay (public, but use their own padded container)
import { DemoIndex } from "@/pages/demo";
import { Replay } from "@/pages/demo/replay";
import { LabIndex } from "@/pages/lab";
import { LabRun } from "@/pages/lab/run";

const queryClient = new QueryClient();

/** Container used for public-surface pages that need padded width. */
function PaddedContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 md:py-14">
      {children}
    </div>
  );
}

function ConsoleArea() {
  return (
    <Layout>
      <Switch>
        <Route path="/console" component={Overview} />
        <Route path="/console/intelligence" component={Intelligence} />
        <Route path="/console/cognition" component={Cognition} />
        <Route
          path="/console/organization-intelligence"
          component={OrganizationIntelligence}
        />
        <Route path="/console/evaluation" component={Evaluation} />
        <Route path="/console/operations" component={Operations} />
        <Route path="/console/benchmarks" component={Benchmarks} />
        <Route path="/console/ingestion" component={Ingestion} />
        <Route path="/console/collaboration" component={Collaboration} />
        <Route path="/console/security" component={Security} />
        <Route path="/console/agents" component={Agents} />
        <Route path="/console/skills" component={Skills} />
        <Route path="/console/providers" component={Providers} />
        <Route path="/console/workflows" component={Workflows} />
        <Route path="/console/memory" component={Memory} />
        <Route path="/console/graph/candidate" component={CandidateGraph} />
        <Route
          path="/console/graph/organization"
          component={OrganizationGraph}
        />
        <Route path="/console/reports" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function PublicArea() {
  return (
    <MarketingLayout>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/why" component={Why} />
        <Route path="/architecture" component={Architecture} />
        <Route path="/benchmarks-public" component={BenchmarksPublic} />
        <Route path="/docs" component={Docs} />
        <Route path="/docs/design-partners">
          <RedirectDocs hash="design-partners" />
        </Route>
        <Route path="/docs/plugins">
          <RedirectDocs hash="plugins" />
        </Route>
        <Route path="/api-explorer" component={ApiExplorer} />
        <Route path="/demo">
          <PaddedContainer>
            <DemoIndex />
          </PaddedContainer>
        </Route>
        <Route path="/replay/:caseId">
          {(params) => (
            <PaddedContainer>
              <Replay key={params.caseId} />
            </PaddedContainer>
          )}
        </Route>
        <Route path="/lab">
          <PaddedContainer>
            <LabIndex />
          </PaddedContainer>
        </Route>
        <Route path="/lab/run/:runId">
          {(params) => (
            <PaddedContainer>
              <LabRun key={params.runId} />
            </PaddedContainer>
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </MarketingLayout>
  );
}

/**
 * Small bridge route: /docs/design-partners and /docs/plugins point at
 * markdown in the GitHub repo. Until we ship a markdown viewer in the
 * console, just bounce the visitor back to /docs with an anchor.
 */
function RedirectDocs({ hash }: { hash: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/docs#${hash}`);
  }, [hash, setLocation]);
  return null;
}

function AppShell() {
  const [location] = useLocation();
  return location.startsWith("/console") ? <ConsoleArea /> : <PublicArea />;
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
