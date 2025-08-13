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
  
  // Filter and sort candidates based on search and filters with priority
  const filteredCandidates = React.useMemo(() => {
    if (!candidates) return [];
    
    let matchedCandidates = candidates.filter(candidate => {
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

          // Complete US state abbreviation to full name mapping
          const stateAbbreviationMap = {
            'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas', 'ca': 'california',
            'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware', 'fl': 'florida', 'ga': 'georgia',
            'hi': 'hawaii', 'id': 'idaho', 'il': 'illinois', 'in': 'indiana', 'ia': 'iowa',
            'ks': 'kansas', 'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
            'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi', 'mo': 'missouri',
            'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada', 'nh': 'new hampshire', 'nj': 'new jersey',
            'nm': 'new mexico', 'ny': 'new york', 'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio',
            'ok': 'oklahoma', 'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
            'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah', 'vt': 'vermont',
            'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia', 'wi': 'wisconsin', 'wy': 'wyoming',
            'dc': 'district of columbia'
          };
          
          // Check if ALL search terms match somewhere in this candidate's data (AND logic)
          const candidateMatches = searchTerms.every(searchTerm => {
            // Check if this search term matches work authorization (with mapping)
            const workAuthMatch = workAuthMappings[searchTerm] === workAuth || workAuth.includes(searchTerm);
            
            // Enhanced location matching with state abbreviation support
            let locationMatch = location.includes(searchTerm);
            
            // If no direct location match, check if search term is a state abbreviation
            if (!locationMatch) {
              // Check if search term is a 2-letter state abbreviation
              if (searchTerm.length === 2 && stateAbbreviationMap[searchTerm]) {
                // Check if location contains the abbreviation (e.g., "Denver, CO")
                locationMatch = location.includes(`, ${searchTerm}`) || location.endsWith(` ${searchTerm}`);
                
                // Also check if location contains the full state name
                if (!locationMatch) {
                  const fullStateName = stateAbbreviationMap[searchTerm];
                  locationMatch = location.includes(fullStateName);
                }
              }
              // Check if search term is a full state name that maps to an abbreviation
              else {
                // Find abbreviation for the full state name
                const stateAbbr = Object.keys(stateAbbreviationMap).find(
                  abbr => stateAbbreviationMap[abbr] === searchTerm
                );
                if (stateAbbr) {
                  // Check if location contains the abbreviation
                  locationMatch = location.includes(`, ${stateAbbr.toUpperCase()}`) || 
                                location.endsWith(` ${stateAbbr.toUpperCase()}`);
                }
              }
            }
            
            // Enhanced job title matching - include broader engineering roles for tech searches
            const techSkillMappings = {
              'java': ['software engineer', 'lead software engineer', 'full stack', 'backend developer', 'senior software'],
              'python': ['software engineer', 'lead software engineer', 'full stack', 'backend developer', 'senior software'],
              '.net': ['software engineer', 'lead software engineer', 'full stack', 'backend developer', 'senior software'],
              'node': ['software engineer', 'lead software engineer', 'full stack', 'backend developer', 'senior software'],
              'nodejs': ['software engineer', 'lead software engineer', 'full stack', 'backend developer', 'senior software'],
              'node js': ['software engineer', 'lead software engineer', 'full stack', 'backend developer', 'senior software'],
              'react': ['software engineer', 'lead software engineer', 'full stack', 'frontend developer', 'senior software'],
              'angular': ['software engineer', 'lead software engineer', 'full stack', 'frontend developer', 'senior software'],
              'vue': ['software engineer', 'lead software engineer', 'full stack', 'frontend developer', 'senior software'],
              'backend': ['software engineer', 'lead software engineer', 'full stack', 'senior software'],
              'frontend': ['software engineer', 'lead software engineer', 'full stack', 'senior software'],
              'developer': ['software engineer', 'lead software engineer', 'senior software']
            };
            
            // Check for direct job title match
            let jobTitleMatch = jobTitle.includes(searchTerm);
            
            // If no direct match, check if this search term should include broader engineering roles
            if (!jobTitleMatch && techSkillMappings[searchTerm]) {
              jobTitleMatch = techSkillMappings[searchTerm].some(broadTitle => 
                jobTitle.includes(broadTitle)
              );
            }
            
            return fullName.includes(searchTerm) || 
                   locationMatch || 
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

    // If there's a search term, sort by relevance (exact matches first, then broader matches)
    if (searchTerm) {
      const searchTerms = searchTerm.split(',').map(term => term.trim().toLowerCase()).filter(term => term.length > 0);
      
      matchedCandidates.sort((a, b) => {
        const aJobTitle = (a.jobTitle || '').toLowerCase();
        const bJobTitle = (b.jobTitle || '').toLowerCase();
        
        // Calculate priority scores for each candidate
        let aScore = 0;
        let bScore = 0;
        
        searchTerms.forEach(searchTerm => {
          // Check if it's a tech skill search
          const techSkills = ['java', 'python', '.net', 'node', 'nodejs', 'node js', 'react', 'angular', 'vue'];
          
          if (techSkills.includes(searchTerm)) {
            // Higher score for exact tech matches in job title
            if (aJobTitle.includes(searchTerm) || aJobTitle.includes(searchTerm + ' developer')) {
              aScore += 10;
            }
            if (bJobTitle.includes(searchTerm) || bJobTitle.includes(searchTerm + ' developer')) {
              bScore += 10;
            }
            
            // Lower score for general engineering roles
            const generalRoles = ['software engineer', 'full stack', 'backend', 'lead software'];
            generalRoles.forEach(role => {
              if (aJobTitle.includes(role)) aScore += 1;
              if (bJobTitle.includes(role)) bScore += 1;
            });
          }
        });
        
        return bScore - aScore; // Higher scores first
      });
    }
    
    return matchedCandidates;
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
