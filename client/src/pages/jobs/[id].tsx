import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useJob } from "@/hooks/use-jobs";
import { useSubmissions } from "@/hooks/use-submissions";
import { useRecruiters } from "@/hooks/use-recruiters";
import { useUpdateJobStatus } from "@/hooks/use-jobs";
import { useAssignRecruiters } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date-utils";
import { sanitizeHtml } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  Users, 
  UserPlus,
  Clock
} from "lucide-react";
import SubmissionTable from "@/components/submission/submission-table";
import SubmissionDialog from "@/components/submission/submission-dialog";
import StatusBadge from "@/components/submission/status-badge";

const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const numericId = parseInt(id);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [selectedRecruiters, setSelectedRecruiters] = useState<number[]>([]);
  
  // Fetch job data
  const { data: job, isLoading: isJobLoading } = useJob(numericId);
  
  // Fetch recruiters for assignment
  const { data: recruiters } = useRecruiters();
  
  // Fetch submissions for this job
  const { data: submissions, isLoading: isSubmissionsLoading } = useSubmissions({ 
    jobId: numericId 
  });
  
  // Mutations
  const { mutate: updateStatus, isPending: isStatusUpdating } = useUpdateJobStatus();
  const { mutate: assignRecruiters, isPending: isAssigning } = useAssignRecruiters();
  
  const handleBack = () => {
    setLocation("/jobs");
  };
  
  const handleStatusChange = (newStatus: string) => {
    updateStatus(
      { id: numericId, status: newStatus },
      {
        onSuccess: () => {
          toast({
            title: "Status updated",
            description: `Job status has been updated to ${newStatus}.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to update status",
            variant: "destructive",
          });
        },
      }
    );
  };
  
  const handleRecruiterSelection = (value: string) => {
    if (value === "none") {
      setSelectedRecruiters([]);
      return;
    }
    setSelectedRecruiters((prev) => 
      prev.includes(parseInt(value)) 
        ? prev.filter(id => id !== parseInt(value)) 
        : [...prev, parseInt(value)]
    );
  };
  
  const handleAssignRecruiters = () => {
    if (selectedRecruiters.length === 0) {
      toast({
        title: "No recruiters selected",
        description: "Please select at least one recruiter to assign.",
        variant: "destructive",
      });
      return;
    }
    
    assignRecruiters(
      { jobId: numericId, recruiterIds: selectedRecruiters },
      {
        onSuccess: () => {
          toast({
            title: "Recruiters assigned",
            description: "Recruiters have been successfully assigned to this job.",
          });
          setSelectedRecruiters([]);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to assign recruiters",
            variant: "destructive",
          });
        },
      }
    );
  };
  
  const handleOpenSubmissionDialog = () => {
    setIsSubmissionDialogOpen(true);
  };
  
  const handleCloseSubmissionDialog = () => {
    setIsSubmissionDialogOpen(false);
  };
  
  if (isJobLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!job) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium text-gray-900">Job not found</h3>
        <p className="mt-2 text-gray-500">The job you're looking for does not exist.</p>
        <Button variant="outline" className="mt-4" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
      </div>
    );
  }
  
  const currentlyAssignedIds = job.assignedRecruiters?.map(r => r.id) || [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center">
        <div className="flex items-start">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-semibold text-gray-900">{job.title}</h2>
              <StatusBadge status={job.status} size="md" />
            </div>
            <p className="mt-1 text-sm text-gray-500">{job.jobId}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Select defaultValue={job.status} onValueChange={handleStatusChange} disabled={isStatusUpdating}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleOpenSubmissionDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            Submit Candidate
          </Button>
        </div>
      </div>
      
      {/* Job details and tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Job details */}
        <div className="md:col-span-1 space-y-6">
          {/* Job info card */}
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>Basic information about this job</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Created On</h4>
                <p className="flex items-center mt-1 text-sm text-gray-700">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {formatDate(job.createdAt)}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Submissions</h4>
                <p className="flex items-center mt-1 text-sm text-gray-700">
                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                  {submissions?.length || 0} candidates
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Status</h4>
                <p className="flex items-center mt-1 text-sm text-gray-700">
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Assigned Recruiters</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.assignedRecruiters && job.assignedRecruiters.length > 0 ? (
                    job.assignedRecruiters.map((recruiter) => (
                      <Badge key={recruiter.id} variant="outline">
                        {recruiter.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No recruiters assigned</p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Assign Recruiters</h4>
                <div className="mt-2 flex flex-col space-y-3">
                  <Select onValueChange={handleRecruiterSelection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recruiters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Clear selection</SelectItem>
                      {recruiters?.map((recruiter) => (
                        <SelectItem 
                          key={recruiter.id} 
                          value={recruiter.id.toString()}
                          disabled={currentlyAssignedIds.includes(recruiter.id)}
                        >
                          {recruiter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedRecruiters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecruiters.map((id) => {
                        const recruiter = recruiters?.find(r => r.id === id);
                        return recruiter ? (
                          <Badge key={id} variant="secondary">
                            {recruiter.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleAssignRecruiters} 
                    disabled={selectedRecruiters.length === 0 || isAssigning}
                    size="sm"
                  >
                    {isAssigning ? "Assigning..." : "Assign Selected"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column - Tabs for description and submissions */}
        <div className="md:col-span-2">
          <Tabs defaultValue="description">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="description">Job Description</TabsTrigger>
              <TabsTrigger value="submissions">Candidate Submissions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="description" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-line">{sanitizeHtml(job.description)}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="submissions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Submissions</CardTitle>
                  <CardDescription>
                    Candidates who have been submitted for this job
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SubmissionTable 
                    submissions={submissions || []} 
                    isLoading={isSubmissionsLoading} 
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Submission dialog */}
      {isSubmissionDialogOpen && (
        <SubmissionDialog
          jobId={numericId}
          jobTitle={job.title}
          jobDescription={sanitizeHtml(job.description)}
          recruiterId={1} // This would be the current user's ID in a real app
          isOpen={isSubmissionDialogOpen}
          onClose={handleCloseSubmissionDialog}
        />
      )}
    </div>
  );
};

export default JobDetailPage;
