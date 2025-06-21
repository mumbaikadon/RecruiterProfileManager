import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Building2, Clock } from "lucide-react";
import { JobApplicationModal } from "./JobApplicationModal";

interface PublicJob {
  id: number;
  jobId: string;
  title: string;
  description: string;
  city: string | null;
  state: string | null;
  jobType: "onsite" | "remote" | "hybrid" | null;
  createdAt: string;
}

export function PublicJobs() {
  const [selectedJob, setSelectedJob] = useState<PublicJob | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);

  const { data: jobs, isLoading } = useQuery<PublicJob[]>({
    queryKey: ["/api/public/jobs"],
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getJobTypeColor = (type: string | null) => {
    switch (type) {
      case "remote":
        return "bg-green-100 text-green-800";
      case "hybrid":
        return "bg-blue-100 text-blue-800";
      case "onsite":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleApply = (job: PublicJob) => {
    setSelectedJob(job);
    setIsApplicationModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading available positions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Join Our Team</h1>
            <p className="text-xl max-w-3xl mx-auto opacity-90">
              Discover exciting career opportunities and become part of our growing organization. 
              We're looking for talented individuals to help us shape the future.
            </p>
            <div className="mt-8 flex justify-center">
              <a href="#job-listings" className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-gray-50 transition-colors duration-200">
                View Open Positions
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Job Listings Section */}
      <div id="job-listings" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Current Openings</h2>
            <div className="w-20 h-1 bg-blue-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore our available positions and find the perfect role for your skills and career goals.
            </p>
          </div>
          
          {!jobs || jobs.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl shadow-sm border border-gray-100">
              <Building2 className="h-20 w-20 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-medium text-gray-900 mb-3">No Open Positions</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                We don't have any open positions at the moment, but we're always looking for great talent. 
                Check back soon for new opportunities!
              </p>
              <Button variant="outline" className="mt-8">
                Subscribe for Job Alerts
              </Button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job, index) => (
                <Card 
                  key={job.id} 
                  className="hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden group"
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeIn 0.5s ease-out forwards'
                  }}
                >
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 group-hover:h-3 transition-all duration-200"></div>
                  <CardHeader>
                    <div className="flex justify-between items-start mb-3">
                      <CardTitle className="text-xl font-bold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors duration-200">
                        {job.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {job.jobId}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {(job.city || job.state) && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                          {[job.city, job.state].filter(Boolean).join(", ")}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        {job.jobType && (
                          <Badge className={`${getJobTypeColor(job.jobType)} px-3 py-1 rounded-full`}>
                            {job.jobType?.charAt(0).toUpperCase() + job.jobType?.slice(1)}
                          </Badge>
                        )}
                        
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1 text-blue-600" />
                          Posted {formatDate(job.createdAt)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="border-t border-gray-100 pt-4 mb-6">
                      <CardDescription className="text-gray-700 line-clamp-3 text-base">
                        {job.description}
                      </CardDescription>
                    </div>
                    
                    <Button 
                      onClick={() => handleApply(job)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 group-hover:shadow-lg transition-all duration-200"
                    >
                      Apply Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Company Values Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Work With Us</h2>
            <div className="w-20 h-1 bg-blue-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Join a team that values innovation, collaboration, and personal growth.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="bg-white p-8 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow duration-300">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Innovation</h3>
              <p className="text-gray-600">
                We encourage creative thinking and embrace new ideas to solve complex challenges.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow duration-300">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Collaboration</h3>
              <p className="text-gray-600">
                We believe in the power of teamwork and diverse perspectives to achieve exceptional results.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md text-center hover:shadow-lg transition-shadow duration-300">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Growth</h3>
              <p className="text-gray-600">
                We invest in our employees' professional development and provide opportunities to learn and advance.
              </p>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-md shadow-md hover:shadow-lg transition-all duration-200">
              Join Our Talent Network
            </Button>
          </div>
        </div>
      </div>
      
      {/* Application Modal */}
      {selectedJob && (
        <JobApplicationModal
          job={selectedJob}
          isOpen={isApplicationModalOpen}
          onClose={() => {
            setIsApplicationModalOpen(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}