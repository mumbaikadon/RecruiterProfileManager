import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import JobsPage from "@/pages/jobs/index";
import JobDetailPage from "@/pages/jobs/[id]";
import CandidatesPage from "@/pages/candidates/index";
import CandidateDetailPage from "@/pages/candidates/[id]";
import SubmissionsPage from "@/pages/submissions/index";
import SubmissionDetailPage from "@/pages/submissions/[id]";
import { PublicJobs } from "@/pages/PublicJobs";

function Router() {
  return (
    <Switch>
      {/* Authentication route */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Public job application route */}
      <Route path="/public/jobs">
        <PublicJobs />
      </Route>
      
      {/* Protected home route */}
      <ProtectedRoute path="/" component={HomePage} />
      
      {/* Protected admin/recruiter routes */}
      <ProtectedRoute 
        path="/dashboard" 
        component={() => (
          <Layout>
            <Dashboard />
          </Layout>
        )} 
      />
      <ProtectedRoute 
        path="/jobs" 
        component={() => (
          <Layout>
            <JobsPage />
          </Layout>
        )} 
      />
      <ProtectedRoute 
        path="/jobs/:id" 
        component={() => (
          <Layout>
            <JobDetailPage />
          </Layout>
        )} 
      />
      <ProtectedRoute 
        path="/candidates" 
        component={() => (
          <Layout>
            <CandidatesPage />
          </Layout>
        )} 
      />
      <ProtectedRoute 
        path="/candidates/:id" 
        component={() => (
          <Layout>
            <CandidateDetailPage />
          </Layout>
        )} 
      />
      <ProtectedRoute 
        path="/submissions" 
        component={() => (
          <Layout>
            <SubmissionsPage />
          </Layout>
        )} 
      />
      <ProtectedRoute 
        path="/submissions/:id" 
        component={() => (
          <Layout>
            <SubmissionDetailPage />
          </Layout>
        )} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
