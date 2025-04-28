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
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${candidate.firstName} ${candidate.middleName || ''} ${candidate.lastName}`.toLowerCase();
        const location = candidate.location.toLowerCase();
        const email = candidate.email.toLowerCase();
        
        if (!fullName.includes(searchLower) && 
            !location.includes(searchLower) && 
            !email.includes(searchLower)) {
          return false;
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
          <h2 className="text-2xl font-semibold text-gray-900">Candidates</h2>
          <p className="mt-1 text-sm text-gray-500">View and manage all candidates</p>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex flex-col space-y-4 md:flex-row md:items-end md:space-y-0 md:space-x-4">
            <div className="w-full md:w-64 relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search candidates..."
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
