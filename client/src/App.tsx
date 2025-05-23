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
import SubmissionDetailPage from "@/pages/submissions/[id]";

// Public pages
import CareersPage from "@/pages/careers/index";
import PublicJobDetailPage from "@/pages/careers/jobs/[id]";

function Router() {
  // Detect if we're on a public page
  const isPublicPage = window.location.pathname.startsWith('/careers');
  
  // If it's a public page, we don't wrap it in the admin Layout
  if (isPublicPage) {
    return (
      <Switch>
        <Route path="/careers" component={CareersPage} />
        <Route path="/careers/jobs/:id" component={PublicJobDetailPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // Admin/recruiter routes that are wrapped in the admin Layout
  return (
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
  );
}

function App() {
  // Detect if we're on a public page
  const isPublicPage = window.location.pathname.startsWith('/careers');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {isPublicPage ? (
          <Router />
        ) : (
          <Layout>
            <Router />
          </Layout>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
