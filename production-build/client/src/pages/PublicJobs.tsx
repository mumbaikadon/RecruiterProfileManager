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
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Join Our Team</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover exciting career opportunities and become part of our growing organization. 
              We're looking for talented individuals to help us shape the future.
            </p>
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Open Positions</h3>
            <p className="text-gray-600">
              We don't have any open positions at the moment, but we're always looking for great talent. 
              Check back soon for new opportunities!
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-xl font-semibold text-gray-900 leading-tight">
                      {job.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {job.jobId}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {(job.city || job.state) && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        {[job.city, job.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                    
                    {job.jobType && (
                      <div className="flex items-center">
                        <Badge className={getJobTypeColor(job.jobType)}>
                          {job.jobType?.charAt(0).toUpperCase() + job.jobType?.slice(1)}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-2" />
                      Posted {formatDate(job.createdAt)}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <CardDescription className="text-gray-700 mb-6 line-clamp-3">
                    {job.description}
                  </CardDescription>
                  
                  <Button 
                    onClick={() => handleApply(job)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Apply Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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