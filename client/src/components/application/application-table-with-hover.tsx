import React, { useState } from "react";
import { formatDate } from "@/lib/date-utils";
import { JobApplication } from "@/hooks/use-applications";
import { useToast } from "@/hooks/use-toast";
import { useUpdateApplicationStatus } from "@/hooks/use-applications";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { 
  CheckCircle, 
  XCircle, 
  MoreVertical, 
  Eye,
  Loader2,
  Download,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Briefcase
} from "lucide-react";
import SubmissionDialog from "@/components/submission/submission-dialog";
import { getStateName } from "@/lib/states";

interface ApplicationTableProps {
  applications: JobApplication[];
  isLoading: boolean;
  jobId: number;
  jobTitle: string;
  jobDescription: string;
  onSuccess?: () => void;
}

const ApplicationStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toLowerCase()) {
    case "pending":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending Review</Badge>;
    case "approved":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
    case "rejected":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const ApplicationTable: React.FC<ApplicationTableProps> = ({
  applications,
  isLoading,
  jobId,
  jobTitle,
  jobDescription,
  onSuccess
}) => {
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMarkAsApprovedOpen, setIsMarkAsApprovedOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateApplicationStatus();

  const handleViewDetails = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsDetailsOpen(true);
  };

  const handleMarkAsApproved = (application: JobApplication) => {
    setSelectedApplication(application);
    setReviewNotes("");
    setIsMarkAsApprovedOpen(true);
  };

  const handleReject = (application: JobApplication) => {
    setSelectedApplication(application);
    setReviewNotes("");
    setIsRejectOpen(true);
  };

  const confirmApproval = () => {
    if (!selectedApplication) return;
    
    updateStatus(
      {
        id: selectedApplication.id,
        status: "approved",
        notes: reviewNotes
      },
      {
        onSuccess: () => {
          toast({
            title: "Application approved",
            description: "The application has been marked as approved.",
          });
          setIsMarkAsApprovedOpen(false);
          
          // If we have a resume file, attempt to download it to display preview in the submission form
          if (selectedApplication.resumeFileName) {
            // Add a message about resume processing
            toast({
              title: "Processing resume",
              description: "Preparing resume data for submission...",
            });
          }
          
          // Open submission dialog to formally add the candidate to submissions
          setIsSubmissionDialogOpen(true);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to approve application",
            variant: "destructive",
          });
        }
      }
    );
  };

  const confirmRejection = () => {
    if (!selectedApplication) return;
    
    updateStatus(
      {
        id: selectedApplication.id,
        status: "rejected",
        notes: reviewNotes
      },
      {
        onSuccess: () => {
          toast({
            title: "Application rejected",
            description: "The application has been marked as rejected.",
          });
          setIsRejectOpen(false);
          setSelectedApplication(null);
          if (onSuccess) onSuccess();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to reject application",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleDownloadResume = (fileName?: string) => {
    if (!fileName) {
      toast({
        title: "No resume available",
        description: "This candidate did not upload a resume.",
        variant: "destructive",
      });
      return;
    }

    // Create a download link for the resume
    window.open(`/uploads/${fileName}`, '_blank');
  };
  
  const handleViewResume = (fileName?: string) => {
    if (!fileName) {
      toast({
        title: "No resume available",
        description: "This candidate did not upload a resume.",
        variant: "destructive",
      });
      return;
    }

    // Open the resume in a new tab with preview mode
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    // For PDF files, browsers can render them directly
    if (fileExtension === 'pdf') {
      window.open(`/uploads/${fileName}`, '_blank');
    } else {
      // For other file types, try to use Google Docs Viewer
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + '/uploads/' + fileName)}&embedded=true`;
      window.open(viewerUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No applications received yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          When candidates apply through the public job board, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Application Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <HoverCard key={application.id} 
              open={hoveredRow === application.id ? true : undefined}
              onOpenChange={(open) => {
                if (open) {
                  setHoveredRow(application.id);
                } else if (hoveredRow === application.id) {
                  setHoveredRow(null);
                }
              }}
            >
              <TableRow 
                className="group cursor-pointer hover:bg-muted/30 transition-colors"
                onMouseEnter={() => setHoveredRow(application.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <HoverCardTrigger asChild>
                  <TableCell className="font-medium">
                    {application.firstName} {application.lastName}
                  </TableCell>
                </HoverCardTrigger>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm">{application.email}</span>
                    <span className="text-xs text-muted-foreground">{application.phone}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {formatDate(new Date(application.appliedAt))}
                </TableCell>
                <TableCell>
                  <ApplicationStatusBadge status={application.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(application)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      
                      {application.resumeFileName && (
                        <>
                          <DropdownMenuItem onClick={() => handleViewResume(application.resumeFileName)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Resume
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadResume(application.resumeFileName)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Resume
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {application.status === "approved" && (
                        <DropdownMenuItem onClick={() => {
                          setSelectedApplication(application);
                          setIsSubmissionDialogOpen(true);
                        }}>
                          <UserPlus className="mr-2 h-4 w-4 text-blue-600" />
                          Submit Candidate
                        </DropdownMenuItem>
                      )}

                      {application.status === "pending" && (
                        <>
                          <DropdownMenuItem onClick={() => handleMarkAsApproved(application)}>
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                            Mark as Fit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReject(application)}>
                            <XCircle className="mr-2 h-4 w-4 text-red-600" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              <HoverCardContent className="w-80">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <h4 className="text-sm font-semibold">
                      {application.firstName} {application.lastName}
                    </h4>
                    <ApplicationStatusBadge status={application.status} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{application.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{application.phone}</span>
                    </div>
                    
                    {(application.city || application.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {[
                            application.city,
                            application.state ? getStateName(application.state) : null
                          ].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    
                    {application.workAuthorization && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{application.workAuthorization}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center border-t pt-2 text-xs text-muted-foreground">
                    <span>Applied on {formatDate(new Date(application.appliedAt))}</span>
                    
                    {application.resumeFileName && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewResume(application.resumeFileName);
                        }}
                      >
                        View Resume
                      </Button>
                    )}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </TableBody>
      </Table>

      {/* Application Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review the candidate's application information
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-medium">Candidate</h4>
                <p className="text-lg font-medium">
                  {selectedApplication.firstName} {selectedApplication.lastName}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium">Email</h4>
                  <p className="text-sm">{selectedApplication.email}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Phone</h4>
                  <p className="text-sm">{selectedApplication.phone}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {selectedApplication.city && (
                  <div>
                    <h4 className="text-sm font-medium">City</h4>
                    <p className="text-sm">{selectedApplication.city}</p>
                  </div>
                )}
                {selectedApplication.state && (
                  <div>
                    <h4 className="text-sm font-medium">State</h4>
                    <p className="text-sm">{getStateName(selectedApplication.state)}</p>
                  </div>
                )}
              </div>
              
              {selectedApplication.workAuthorization && (
                <div>
                  <h4 className="text-sm font-medium">Work Authorization</h4>
                  <p className="text-sm">{selectedApplication.workAuthorization}</p>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium">Application Date</h4>
                <p className="text-sm">{formatDate(new Date(selectedApplication.appliedAt))}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium">Status</h4>
                <div className="mt-1">
                  <ApplicationStatusBadge status={selectedApplication.status} />
                </div>
              </div>
              
              {selectedApplication.notes && (
                <div>
                  <h4 className="text-sm font-medium">Notes</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedApplication.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex space-x-2 mt-4">
            {selectedApplication?.resumeFileName && (
              <Button 
                variant="outline" 
                onClick={() => handleViewResume(selectedApplication.resumeFileName)}
              >
                View Resume
              </Button>
            )}
            <Button onClick={() => setIsDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Approved Dialog */}
      <Dialog open={isMarkAsApprovedOpen} onOpenChange={setIsMarkAsApprovedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Fit</DialogTitle>
            <DialogDescription>
              This will mark the application as approved and allow you to submit the candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Notes (Optional)</h4>
              <Textarea 
                placeholder="Add any notes about why this candidate is a good fit..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsMarkAsApprovedOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmApproval}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              This will mark the application as rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Notes (Optional)</h4>
              <Textarea 
                placeholder="Add any notes about why this candidate is not a good fit..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmRejection}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Dialog */}
      {isSubmissionDialogOpen && selectedApplication && (
        <SubmissionDialog
          isOpen={isSubmissionDialogOpen}
          onClose={() => {
            setIsSubmissionDialogOpen(false);
            if (onSuccess) onSuccess();
          }}
          jobId={jobId}
          jobTitle={jobTitle}
          jobDescription={jobDescription}
          recruiterId={selectedApplication.recruiterId || 1} 
          initialCandidateData={{
            firstName: selectedApplication.firstName,
            lastName: selectedApplication.lastName,
            email: selectedApplication.email,
            phone: selectedApplication.phone,
            location: selectedApplication.city ? `${selectedApplication.city}, ${selectedApplication.state || ''}` : '',
          }}
          applicationResumeFileName={selectedApplication.resumeFileName}
          applicationId={selectedApplication.id}
        />
      )}
    </div>
  );
};

export default ApplicationTable;