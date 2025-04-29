import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import JobsPage from "@/pages/jobs/index";
import JobDetailPage from "@/pages/jobs/[id]";
import CandidatesPage from "@/pages/candidates/index";
import CandidateDetailPage from "@/pages/candidates/[id]";
import SubmissionsPage from "@/pages/submissions/index";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/jobs/:id" component={JobDetailPage} />
      <Route path="/candidates" component={CandidatesPage} />
      <Route path="/candidates/:id" component={CandidateDetailPage} />
      <Route path="/submissions" component={SubmissionsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Layout>
          <Router />
        </Layout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
