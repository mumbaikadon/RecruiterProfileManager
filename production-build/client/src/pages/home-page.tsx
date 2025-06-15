import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Job } from "@shared/schema";
import { MapPin, Clock, Briefcase, LogOut, User } from "lucide-react";
import { Link } from "wouter";

// Job seeker view - shows available jobs
function JobSeekerDashboard() {
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/public/jobs"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Available Opportunities</h2>
        <p className="text-lg text-gray-600">Discover your next career move</p>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{job.title}</CardTitle>
                  <Badge variant={job.status === "active" ? "default" : "secondary"}>
                    {job.status}
                  </Badge>
                </div>
                <CardDescription className="text-sm text-gray-500">
                  Job ID: {job.jobId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 line-clamp-3">{job.description}</p>
                
                <div className="space-y-2">
                  {(job.city || job.state) && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      {[job.city, job.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                  
                  {job.jobType && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Briefcase className="w-4 h-4 mr-2" />
                      {job.jobType}
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <Link href={`/jobs/apply/${job.id}`}>
                  <Button className="w-full mt-4">
                    Apply Now
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Briefcase className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Available</h3>
            <p className="text-gray-600">Check back soon for new opportunities.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Admin/Recruiter view - redirects to dashboard
function RecruiterDashboard() {
  return (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Recruiter Dashboard</h2>
        <p className="text-lg text-gray-600">Manage jobs, candidates, and submissions</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
        <Link href="/dashboard">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="text-center py-8">
              <Briefcase className="w-12 h-12 mx-auto text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Job Management</h3>
              <p className="text-gray-600">Create and manage job postings</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/candidates">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="text-center py-8">
              <User className="w-12 h-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Candidates</h3>
              <p className="text-gray-600">Review and manage candidates</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/submissions">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Submissions</h3>
              <p className="text-gray-600">Track application status</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, logoutMutation } = useAuth();

  if (!user) {
    return null; // This should be handled by ProtectedRoute
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Recruitment Platform</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">{user.name}</span>
                <Badge variant="outline">{user.role}</Badge>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.role === "job_seeker" ? (
          <JobSeekerDashboard />
        ) : (
          <RecruiterDashboard />
        )}
      </main>
    </div>
  );
}