import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

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
import { CandidateGraph } from "@/pages/graph/candidate";
import { OrganizationGraph } from "@/pages/graph/organization";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/intelligence" component={Intelligence} />
      <Route path="/cognition" component={Cognition} />
      <Route path="/organization-intelligence" component={OrganizationIntelligence} />
      <Route path="/evaluation" component={Evaluation} />
      <Route path="/operations" component={Operations} />
      <Route path="/benchmarks" component={Benchmarks} />
      <Route path="/ingestion" component={Ingestion} />
      <Route path="/collaboration" component={Collaboration} />
      <Route path="/agents" component={Agents} />
      <Route path="/skills" component={Skills} />
      <Route path="/providers" component={Providers} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/memory" component={Memory} />
      <Route path="/reports" component={Reports} />
      <Route path="/graph/candidate" component={CandidateGraph} />
      <Route path="/graph/organization" component={OrganizationGraph} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
