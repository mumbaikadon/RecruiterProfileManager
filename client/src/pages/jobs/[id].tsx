import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useJob } from "@/hooks/use-jobs";
import { useSubmissions } from "@/hooks/use-submissions";
import { useRecruiters } from "@/hooks/use-recruiters";
import { useUpdateJobStatus } from "@/hooks/use-jobs";
import { useAssignRecruiters } from "@/hooks/use-jobs";
import { useJobApplications } from "@/hooks/use-applications";
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
  Clock,
  Pencil,
  MapPin,
  Building2,
  Briefcase as BriefcaseIcon,
  Target,
  DollarSign
} from "lucide-react";
import SubmissionTable from "@/components/submission/submission-table";
import SubmissionDialog from "@/components/submission/submission-dialog";
import StatusBadge from "@/components/submission/status-badge";
import JobDescriptionEditDialog from "@/components/job/job-description-edit-dialog";
import { RecommendedCandidates } from "@/components/job/recommended-candidates";
import ApplicationTable from "@/components/application/application-table";

const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const numericId = parseInt(id);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
  const [selectedRecruiters, setSelectedRecruiters] = useState<number[]>([]);
  
  // Fetch job data
  const { data: job, isLoading: isJobLoading } = useJob(numericId);
  
  // Fetch recruiters for assignment
  const { data: recruiters } = useRecruiters();
  
  // Fetch submissions for this job
  const { data: submissions, isLoading: isSubmissionsLoading, refetch: refetchSubmissions } = useSubmissions({ 
    jobId: numericId 
  });
  
  // Fetch applications for this job
  const { data: applications, isLoading: isApplicationsLoading, refetch: refetchApplications } = useJobApplications({
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
        <h3 className="text-xl font-medium text-foreground">Job not found</h3>
        <p className="mt-2 text-muted-foreground">The job you're looking for does not exist.</p>
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
              <h2 className="text-2xl font-semibold text-foreground">{job.title}</h2>
              <StatusBadge status={job.status} size="md" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{job.jobId}</p>
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
                <h4 className="text-sm font-medium text-muted-foreground">Created On</h4>
                <p className="flex items-center mt-1 text-sm text-foreground">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  {formatDate(job.createdAt)}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Client</h4>
                <p className="flex items-center mt-1 text-sm text-foreground">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  {job.clientName || "Not specified"}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Work Model</h4>
                <p className="flex items-center mt-1 text-sm text-foreground">
                  <BriefcaseIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  {job.jobType ? job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1) : "Not specified"}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Location</h4>
                <p className="flex items-center mt-1 text-sm text-foreground">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  {[job.city, job.state].filter(Boolean).join(", ") || "Not specified"}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Submissions</h4>
                <p className="flex items-center mt-1 text-sm text-foreground">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  {submissions?.length || 0} candidates
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                <p className="flex items-center mt-1 text-sm text-foreground">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </p>
              </div>
              
              {job.clientFocus && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Client Focus Areas</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {job.clientFocus.split(',').map((focus, index) => (
                      <Badge key={index} variant="outline" className="bg-green-100/20 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800/30">
                        <Target className="h-3 w-3 mr-1" />
                        {focus.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Assigned Recruiters</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.assignedRecruiters && job.assignedRecruiters.length > 0 ? (
                    job.assignedRecruiters.map((recruiter) => (
                      <Badge key={recruiter.id} variant="outline">
                        {recruiter.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recruiters assigned</p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Assign Recruiters</h4>
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="description">Job Description</TabsTrigger>
              <TabsTrigger value="submissions">Candidate Submissions</TabsTrigger>
              <TabsTrigger value="applied">Applied Candidates</TabsTrigger>
              <TabsTrigger value="recommended">Recommended Candidates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="description" className="mt-4">
              <Card>
                <CardHeader className="pb-0 pt-6">
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsDescriptionDialogOpen(true)}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Description
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="whitespace-pre-line text-foreground">{sanitizeHtml(job.description)}</p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Job description edit dialog */}
              {isDescriptionDialogOpen && (
                <JobDescriptionEditDialog
                  isOpen={isDescriptionDialogOpen}
                  onClose={() => setIsDescriptionDialogOpen(false)}
                  jobId={numericId}
                  jobTitle={job.title}
                  currentDescription={job.description || ''}
                />
              )}
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
            
            <TabsContent value="applied" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Applied Candidates</CardTitle>
                  <CardDescription>
                    Candidates who have applied directly through the public job board
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ApplicationTable 
                    applications={applications || []}
                    isLoading={isApplicationsLoading}
                    jobId={numericId}
                    jobTitle={job?.title || ''}
                    jobDescription={job?.description || ''}
                    onSuccess={() => {
                      // Refetch both applications and submissions after an action is taken
                      refetchApplications();
                      refetchSubmissions();
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="recommended" className="mt-4">
              <RecommendedCandidates 
                jobId={numericId}
                onSubmitCandidate={(candidateId) => {
                  // When a candidate is selected from recommendations, open the submission dialog
                  setIsSubmissionDialogOpen(true);
                  // In a full implementation, we would pre-select this candidate in the dialog
                }}
              />
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
          onSuccess={() => {
            // Refetch the submissions when a new submission is created
            refetchSubmissions();
          }}
        />
      )}
    </div>
  );
};

export default JobDetailPage;
