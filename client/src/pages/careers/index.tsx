import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Search, MapPin, Building, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { format } from "date-fns";
import JobCard from "@/components/public/job-card";

export default function CareersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch all active jobs
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["/api/public/jobs"],
  });
  
  // Filter jobs based on search term
  const filteredJobs = jobs?.filter(job => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase();
    return (
      job.title.toLowerCase().includes(term) ||
      (job.clientName && job.clientName.toLowerCase().includes(term)) ||
      (job.location && job.location.toLowerCase().includes(term))
    );
  });
  
  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Career Opportunities</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover exciting roles with our top-tier clients across the technology industry
        </p>
      </div>
      
      {/* Search bar */}
      <div className="relative max-w-lg mx-auto mb-10">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for job title, company, or location"
          className="pl-10"
        />
      </div>
      
      {/* Job listings */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {filteredJobs 
              ? `${filteredJobs.length} ${filteredJobs.length === 1 ? 'Job' : 'Jobs'} Available` 
              : 'Available Positions'}
          </h2>
        </div>
        
        <Separator />
        
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">There was an error loading jobs. Please try again later.</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
              Refresh
            </Button>
          </div>
        ) : filteredJobs?.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No jobs found matching your search.</p>
            {searchTerm && (
              <Button onClick={() => setSearchTerm("")} variant="outline" className="mt-4">
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredJobs?.map((job) => (
              <JobCard 
                key={job.id} 
                id={job.id}
                title={job.title}
                company={job.clientName}
                location={job.location}
                type={job.jobType}
                postedDate={job.postedDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}