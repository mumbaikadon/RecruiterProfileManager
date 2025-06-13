import { Switch, Route, useLocation } from "wouter";
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
import SubmissionDetailPage from "@/pages/submissions/[id]";
import { PublicJobs } from "@/pages/PublicJobs";

function Router() {
  const [location] = useLocation();
  const isPublicRoute = location.startsWith('/public');

  return (
    <Switch>
      <Route path="/public/jobs">
        {/* Public routes don't use the admin layout */}
        <PublicJobs />
      </Route>
      {/* Admin routes use the admin layout */}
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/jobs" component={JobsPage} />
          <Route path="/jobs/:id" component={JobDetailPage} />
          <Route path="/candidates" component={CandidatesPage} />
          <Route path="/candidates/:id" component={CandidateDetailPage} />
          <Route path="/submissions" component={SubmissionsPage} />
          <Route path="/submissions/:id" component={SubmissionDetailPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
