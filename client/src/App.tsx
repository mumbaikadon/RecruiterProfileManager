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
import NotificationsPage from "@/pages/notifications";

// Public pages
import CareersPage from "@/pages/careers/index";
import PublicJobDetailPage from "@/pages/careers/jobs/[id]";
import PublicLayout from "@/components/public-layout";

function Router() {
  const [location] = useLocation();
  const isPublicPage = location.startsWith('/careers');
  
  // Public routes (with public layout) vs Admin routes (with admin layout)
  return isPublicPage ? (
    // Public routes with public layout
    <PublicLayout>
      <Switch>
        <Route path="/careers" component={CareersPage} />
        <Route path="/careers/jobs/:id" component={PublicJobDetailPage} />
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  ) : (
    // Admin routes wrapped in admin Layout
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/jobs" component={JobsPage} />
        <Route path="/jobs/:id" component={JobDetailPage} />
        <Route path="/candidates" component={CandidatesPage} />
        <Route path="/candidates/:id" component={CandidateDetailPage} />
        <Route path="/submissions" component={SubmissionsPage} />
        <Route path="/submissions/:id" component={SubmissionDetailPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  // We'll handle the public vs admin layout in the Router component
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
