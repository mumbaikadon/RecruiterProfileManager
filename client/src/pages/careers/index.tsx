import React, { useState } from "react";
import { Search, MapPin, Filter } from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import PublicLayout from "@/components/public-layout";
import JobCard from "@/components/public/job-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CareersPage: React.FC = () => {
  const [filters, setFilters] = useState({
    search: "",
    location: "",
    status: "active" // We only show active jobs on the public site
  });

  // Only show active jobs on public site
  const { data: jobs, isLoading } = useJobs({ status: "active" });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value });
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, location: e.target.value });
  };

  // Filter jobs based on search and location
  const filteredJobs = jobs?.filter(job => {
    const matchesSearch = !filters.search || 
      job.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      job.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      (job.clientName && job.clientName.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesLocation = !filters.location || 
      (job.city && job.city.toLowerCase().includes(filters.location.toLowerCase())) ||
      (job.state && job.state.toLowerCase().includes(filters.location.toLowerCase()));
    
    return matchesSearch && matchesLocation;
  });

  return (
    <div>
      <div className="bg-primary text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Find Your Next Career Opportunity</h1>
            <p className="text-xl opacity-90 mb-8">
              Browse our open positions and join our talented team
            </p>
            
            {/* Search box */}
            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input 
                  className="pl-10 w-full" 
                  placeholder="Search jobs by title, skills, or keywords"
                  value={filters.search}
                  onChange={handleSearchChange}
                />
              </div>
              <div className="relative md:w-64">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input 
                  className="pl-10 w-full" 
                  placeholder="Location"
                  value={filters.location}
                  onChange={handleLocationChange}
                />
              </div>
              <Button type="submit" className="whitespace-nowrap">
                Find Jobs
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Job listings */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isLoading ? 'Loading jobs...' : 
              filteredJobs?.length ? `${filteredJobs.length} Open Positions` : 'No Jobs Found'}
          </h2>
          
          <div className="flex gap-3">
            <Select defaultValue="newest">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alphabetical">A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredJobs?.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search criteria or check back later for new opportunities.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs?.map(job => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CareersPage;