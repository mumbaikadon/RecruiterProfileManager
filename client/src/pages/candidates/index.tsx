import React, { useState } from "react";
import { useCandidates } from "@/hooks/use-candidates";
import CandidateTable from "@/components/candidate/candidate-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CandidatesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  
  // Fetch all candidates
  const { data: candidates, isLoading } = useCandidates();
  
  // Filter candidates based on search and filters
  const filteredCandidates = React.useMemo(() => {
    if (!candidates) return [];
    
    return candidates.filter(candidate => {
      // Apply general search filter (name and email)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${candidate.firstName} ${candidate.middleName || ''} ${candidate.lastName}`.toLowerCase();
        const email = candidate.email.toLowerCase();
        
        if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
          return false;
        }
      }
      
      // Apply job title filter
      if (jobTitleFilter) {
        const jobTitleLower = jobTitleFilter.toLowerCase();
        const candidateJobTitle = (candidate.jobTitle || '').toLowerCase();
        
        if (!candidateJobTitle.includes(jobTitleLower)) {
          return false;
        }
      }
      
      // Apply location filter
      if (locationFilter) {
        const locationLower = locationFilter.toLowerCase();
        const candidateLocation = candidate.location.toLowerCase();
        
        if (!candidateLocation.includes(locationLower)) {
          return false;
        }
      }
      
      // Apply work authorization filter
      if (filterType) {
        if (filterType === 'citizen' && candidate.workAuthorization !== 'citizen') {
          return false;
        } else if (filterType === 'green-card' && candidate.workAuthorization !== 'green-card') {
          return false;
        } else if (filterType === 'visa' && 
                  !['h1b', 'ead', 'other'].includes(candidate.workAuthorization)) {
          return false;
        }
      }
      
      return true;
    });
  }, [candidates, searchTerm, jobTitleFilter, locationFilter, filterType]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleFilterChange = (value: string) => {
    setFilterType(value === "all" ? null : value);
  };
  
  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType(null);
    setJobTitleFilter("");
    setLocationFilter("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Candidates</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and manage all candidates</p>
        </div>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-lg border border-border">
        <div className="px-4 py-5 sm:px-6 border-b border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
            {/* General Search */}
            <div className="relative">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Name / Email
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search by name or email..."
                  className="pl-8"
                />
              </div>
            </div>
            
            {/* Job Title Filter */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Job Title
              </label>
              <Input
                value={jobTitleFilter}
                onChange={(e) => setJobTitleFilter(e.target.value)}
                placeholder="Filter by job title..."
              />
            </div>
            
            {/* Location Filter */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Location
              </label>
              <Input
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Filter by location..."
              />
            </div>
            
            {/* Work Authorization Filter */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Work Authorization
              </label>
              <Select value={filterType || "all"} onValueChange={handleFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="citizen">US Citizen</SelectItem>
                  <SelectItem value="green-card">Green Card</SelectItem>
                  <SelectItem value="visa">Visa/Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Clear Filters Button */}
            {(searchTerm || filterType || jobTitleFilter || locationFilter) && (
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="h-9">
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            )}
          </div>
          
          {/* Results Count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredCandidates.length} of {candidates?.length || 0} candidates
            {(searchTerm || filterType || jobTitleFilter || locationFilter) && (
              <span className="ml-2 text-primary">
                (filtered)
              </span>
            )}
          </div>
        </div>
        
        <CandidateTable 
          candidates={filteredCandidates} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
};

export default CandidatesPage;
