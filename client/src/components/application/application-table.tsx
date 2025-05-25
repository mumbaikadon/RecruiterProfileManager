import React, { useState } from "react";
import { formatDate } from "@/lib/date-utils";
import { JobApplication } from "@/hooks/use-applications";
import { useToast } from "@/hooks/use-toast";
import { useUpdateApplicationStatus } from "@/hooks/use-applications";

// Helper function to convert state abbreviation to full state name
const getStateName = (abbreviation: string): string => {
  const stateMap: {[key: string]: string} = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 
    'DC': 'District Of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 
    'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 
    'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 
    'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 
    'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 
    'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 
    'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 
    'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
  };
  
  return stateMap[abbreviation.toUpperCase()] || abbreviation;
};

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
  CheckCircle, 
  XCircle, 
  MoreVertical, 
  Eye,
  Loader2,
  Download,
  UserPlus
} from "lucide-react";
import SubmissionDialog from "@/components/submission/submission-dialog";

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
            <TableRow key={application.id}>
              <TableCell className="font-medium">
                {application.firstName} {application.lastName}
              </TableCell>
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
              
              {(selectedApplication.city || selectedApplication.state) && (
                <div>
                  <h4 className="text-sm font-medium">Location</h4>
                  <p className="text-sm">
                    {[
                      selectedApplication.city,
                      selectedApplication.state ? getStateName(selectedApplication.state) : null
                    ].filter(Boolean).join(", ") || "Not specified"}
                  </p>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium">Work Authorization</h4>
                <p className="text-sm">{selectedApplication.workAuthorization || "Not specified"}</p>
              </div>
              
              {selectedApplication.resumeFileName && (
                <div>
                  <h4 className="text-sm font-medium">Resume</h4>
                  <div className="mt-2 flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewResume(selectedApplication.resumeFileName)}
                      className="text-xs"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View Resume
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadResume(selectedApplication.resumeFileName)}
                      className="text-xs"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
              
              {selectedApplication.coverLetter && (
                <div>
                  <h4 className="text-sm font-medium">Cover Letter</h4>
                  <p className="text-sm whitespace-pre-line border p-3 rounded-md bg-muted mt-1 max-h-32 overflow-y-auto">
                    {selectedApplication.coverLetter}
                  </p>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium">Status</h4>
                <div className="mt-1">
                  <ApplicationStatusBadge status={selectedApplication.status} />
                </div>
              </div>
              
              {selectedApplication.notes && (
                <div>
                  <h4 className="text-sm font-medium">Review Notes</h4>
                  <p className="text-sm whitespace-pre-line border p-3 rounded-md bg-muted mt-1">
                    {selectedApplication.notes}
                  </p>
                </div>
              )}
              
              <div className="flex justify-between pt-4">
                {selectedApplication.status === "pending" && (
                  <>
                    <Button 
                      variant="outline" 
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        setTimeout(() => handleReject(selectedApplication), 100);
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-green-300 text-green-600 hover:bg-green-50"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        setTimeout(() => handleMarkAsApproved(selectedApplication), 100);
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Fit
                    </Button>
                  </>
                )}
                {selectedApplication.status !== "pending" && (
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDetailsOpen(false)}
                    className="ml-auto"
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark as Approved Dialog */}
      <Dialog open={isMarkAsApprovedOpen} onOpenChange={setIsMarkAsApprovedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Application as Fit</DialogTitle>
            <DialogDescription>
              This will mark the application as approved and allow you to create a formal submission.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Add any notes about this approval (optional)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMarkAsApprovedOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmApproval} 
              disabled={isUpdatingStatus}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this application.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Add notes explaining the rejection reason"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRejection}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Dialog - Shown after approval */}
      {isSubmissionDialogOpen && selectedApplication && (
        <SubmissionDialog
          jobId={jobId}
          jobTitle={jobTitle}
          jobDescription={jobDescription}
          recruiterId={1} // This would be the current user's ID in a real app
          isOpen={isSubmissionDialogOpen}
          onClose={() => setIsSubmissionDialogOpen(false)}
          onSuccess={() => {
            setIsSubmissionDialogOpen(false);
            if (onSuccess) onSuccess();
          }}
          initialCandidateData={{
            firstName: selectedApplication.firstName,
            lastName: selectedApplication.lastName,
            email: selectedApplication.email,
            phone: selectedApplication.phone,
            // Leave DOB and SSN fields empty for the recruiter to fill out
            workAuthorization: selectedApplication.workAuthorization || "",
            agreedRate: 0
          }}
          applicationResumeFileName={selectedApplication.resumeFileName || undefined}
          applicationId={selectedApplication.id} // Pass the application ID so it can be marked as processed
        />
      )}
    </div>
  );
};

export default ApplicationTable;