import React, { useState } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import SubmissionTable from "@/components/submission/submission-table";
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

const SubmissionsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  // Fetch all submissions
  const { data: rawSubmissions, isLoading } = useSubmissions();
  
  // Use the actual submission data from the API with its related entities
  const submissions = React.useMemo(() => {
    if (!rawSubmissions) return [];
    
    // The API now returns full data for job, candidate, and recruiter
    return rawSubmissions;
  }, [rawSubmissions]);
  
  // Filter submissions based on search and status
  const filteredSubmissions = React.useMemo(() => {
    if (!submissions) return [];
    
    return submissions.filter(submission => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const jobTitle = submission.job?.title?.toLowerCase() || '';
        const candidateName = `${submission.candidate?.firstName || ''} ${submission.candidate?.lastName || ''}`.toLowerCase();
        
        if (!jobTitle.includes(searchLower) && !candidateName.includes(searchLower)) {
          return false;
        }
      }
      
      // Apply status filter
      if (statusFilter && submission.status !== statusFilter) {
        return false;
      }
      
      return true;
    });
  }, [submissions, searchTerm, statusFilter]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleStatusChange = (value: string) => {
    setStatusFilter(value === "all" ? null : value);
  };
  
  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Submissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and manage all candidate submissions</p>
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
                placeholder="Search submissions..."
                className="pl-8"
              />
            </div>
            
            <div className="w-full md:w-40">
              <Select value={statusFilter || "all"} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="submitted_to_vendor">Submitted To Vendor</SelectItem>
                  <SelectItem value="rejected_by_vendor">Rejected By Vendor</SelectItem>
                  <SelectItem value="submitted_to_client">Submitted To Client</SelectItem>
                  <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                  <SelectItem value="interview_completed">Interview Completed</SelectItem>
                  <SelectItem value="offer_extended">Offer Extended</SelectItem>
                  <SelectItem value="offer_accepted">Offer Accepted</SelectItem>
                  <SelectItem value="offer_declined">Offer Declined</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(searchTerm || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>
        
        <SubmissionTable 
          submissions={filteredSubmissions} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
};

export default SubmissionsPage;
