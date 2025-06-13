import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Job } from "@shared/schema";
import { MapPin, Clock, Briefcase, LogIn, Users, CheckCircle, Zap, Target, Shield, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function PublicHome() {
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/public/jobs"],
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <Zap className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Velocity Tech</h1>
              </div>
            </div>
            
            <Link href="/auth">
              <Button>
                <LogIn className="w-4 h-4 mr-2" />
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Accelerate Your Career
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
              Velocity Tech connects top talent with leading companies through intelligent recruitment solutions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <a href="#jobs">View Available Jobs</a>
              </Button>
              <Link href="/public/jobs">
                <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
                  Apply Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Velocity Tech?</h2>
            <p className="text-lg text-gray-600">Accelerating careers through intelligent recruitment</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Precision Matching</h3>
              <p className="text-gray-600">Advanced AI algorithms connect you with roles that match your exact skills and career goals</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Trusted Security</h3>
              <p className="text-gray-600">Enterprise-grade security protects your data throughout the recruitment process</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Career Acceleration</h3>
              <p className="text-gray-600">Fast-track your career with opportunities from leading technology companies</p>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs Section */}
      <section id="jobs" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Latest Opportunities</h2>
            <p className="text-lg text-gray-600">Discover exciting career opportunities</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center min-h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {jobs.slice(0, 6).map((job) => (
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
                    
                    <Link href="/public/jobs">
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

          {jobs && jobs.length > 6 && (
            <div className="text-center mt-8">
              <Link href="/public/jobs">
                <Button size="lg">View All Jobs</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-4">Recruitment Platform</h3>
            <p className="text-gray-400">Connecting talent with opportunity through AI-powered matching</p>
          </div>
        </div>
      </footer>
    </div>
  );
}