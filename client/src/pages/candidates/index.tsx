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
  
  // Fetch all candidates
  const { data: candidates, isLoading } = useCandidates();
  
  // Filter candidates based on search and filters
  const filteredCandidates = React.useMemo(() => {
    if (!candidates) return [];
    
    return candidates.filter(candidate => {
      // Apply search filter with comma-separated terms (AND logic)
      if (searchTerm) {
        // Split search terms by comma and trim whitespace
        const searchTerms = searchTerm.split(',').map(term => term.trim().toLowerCase()).filter(term => term.length > 0);
        
        if (searchTerms.length > 0) {
          const fullName = `${candidate.firstName} ${candidate.middleName || ''} ${candidate.lastName}`.toLowerCase();
          const location = candidate.location.toLowerCase();
          const email = candidate.email.toLowerCase();
          const jobTitle = (candidate.jobTitle || '').toLowerCase();
          const experience = candidate.yearsOfExperience?.toString() || '';
          const workAuth = candidate.workAuthorization.toLowerCase();
          
          // Enhanced work authorization matching - map different search terms to stored values
          const workAuthMappings = {
            'us': 'citizen',
            'usc': 'citizen',
            'citizen': 'citizen',
            'us citizen': 'citizen',
            'ead': 'ead',
            'gc': 'green-card',
            'green card': 'green-card',
            'green': 'green-card',
            'greencard': 'green-card',
            'other': 'other'
          };
          
          // Check if ALL search terms match somewhere in this candidate's data (AND logic)
          const candidateMatches = searchTerms.every(searchTerm => {
            // Check if this search term matches work authorization (with mapping)
            const workAuthMatch = workAuthMappings[searchTerm] === workAuth || workAuth.includes(searchTerm);
            
            // Enhanced job title matching - when searching for tech skills, include broader engineering roles
            const techSkillsToEngineeringRoles = {
              'java': ['software engineer', 'fullstack engineer', 'backend engineer', 'lead software engineer'],
              'python': ['software engineer', 'fullstack engineer', 'backend engineer', 'lead software engineer'],
              '.net': ['software engineer', 'fullstack engineer', 'backend engineer', 'lead software engineer'],
              'node': ['software engineer', 'fullstack engineer', 'backend engineer', 'lead software engineer'],
              'nodejs': ['software engineer', 'fullstack engineer', 'backend engineer', 'lead software engineer'],
              'node js': ['software engineer', 'fullstack engineer', 'backend engineer', 'lead software engineer']
            };
            
            // Check for direct job title match first
            let jobTitleMatch = jobTitle.includes(searchTerm);
            
            // If searching for a tech skill, also include candidates with broader engineering titles
            if (!jobTitleMatch && techSkillsToEngineeringRoles[searchTerm]) {
              jobTitleMatch = techSkillsToEngineeringRoles[searchTerm].some(engineeringRole => 
                jobTitle.includes(engineeringRole)
              );
            }
            
            return fullName.includes(searchTerm) || 
                   location.includes(searchTerm) || 
                   email.includes(searchTerm) ||
                   jobTitleMatch ||
                   experience.includes(searchTerm) ||
                   workAuthMatch;
          });
          
          if (!candidateMatches) {
            return false;
          }
        }
      }
      
      // Apply type filter
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
  }, [candidates, searchTerm, filterType]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleFilterChange = (value: string) => {
    setFilterType(value === "all" ? null : value);
  };
  
  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Candidates</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and manage all candidates with job titles and experience levels</p>
        </div>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-lg border border-border">
        <div className="px-4 py-5 sm:px-6 border-b border-border">
          <div className="flex flex-col space-y-4 md:flex-row md:items-end md:space-y-0 md:space-x-4">
            <div className="w-full md:w-64 relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search by name, location, skills, experience, work auth (e.g., 'java, us' finds Java developers with US citizenship)..."
                className="pl-8"
              />
            </div>
            
            <div className="w-full md:w-40">
              <Select value={filterType || "all"} onValueChange={handleFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Work Auth" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="citizen">US Citizen</SelectItem>
                  <SelectItem value="green-card">Green Card</SelectItem>
                  <SelectItem value="visa">Visa/Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(searchTerm || filterType) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
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
