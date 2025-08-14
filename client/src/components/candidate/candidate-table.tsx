import React, { useState } from "react";
import { useLocation } from "wouter";
import { formatDate, formatDob } from "@/lib/date-utils";
import { Candidate } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  AlertTriangle, 
  UploadCloud, 
  XCircle, 
  CheckCircle,
  Download 
} from "lucide-react";
import ActionsDropdown from "@/components/ui/actions-dropdown";
import QuickSubmitDialog from "./quick-submit-dialog";
import { cn } from "@/lib/utils";
import ResubmitDialog from "./resubmit-dialog";
import CandidateUnrealDialog from "./candidate-unreal-dialog";
import SuspiciousBadge from "../submission/suspicious-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CandidateTableProps {
  candidates: Array<Candidate & { jobTitle?: string; yearsOfExperience?: number }>;
  isLoading?: boolean;
}

const CandidateTable: React.FC<CandidateTableProps> = ({ 
  candidates, 
  isLoading = false 
}) => {
  const [_, setLocation] = useLocation();
  const [isResubmitDialogOpen, setIsResubmitDialogOpen] = useState(false);
  const [isUnrealDialogOpen, setIsUnrealDialogOpen] = useState(false);
  const [isQuickSubmitDialogOpen, setIsQuickSubmitDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<{
    id: number, 
    name: string, 
    isUnreal?: boolean,
    unrealReason?: string | null
  } | null>(null);

  const handleViewCandidate = (id: number) => {
    setLocation(`/candidates/${id}`);
  };
  
  const handleResubmitCandidate = (id: number, name: string) => {
    setSelectedCandidate({ id, name });
    setIsResubmitDialogOpen(true);
  };
  
  const handleQuickSubmit = (id: number, name: string) => {
    setSelectedCandidate({ id, name });
    setIsQuickSubmitDialogOpen(true);
  };
  
  const handleToggleUnreal = (
    e: React.MouseEvent, 
    id: number, 
    name: string,
    isUnreal: boolean,
    unrealReason?: string | null
  ) => {
    e.stopPropagation();
    setSelectedCandidate({ id, name, isUnreal, unrealReason });
    setIsUnrealDialogOpen(true);
  };

  const handleDownloadResume = async (candidateId: number, candidateName: string) => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/resume/download`);
      
      if (!response.ok) {
        if (response.status === 404) {
          alert('Resume file not found. The candidate may not have uploaded a resume.');
          return;
        }
        throw new Error(`Failed to download resume: ${response.status}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${candidateName.replace(/\s+/g, '_')}_resume`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download resume. Please try again.');
    }
  };

  const handleDownloadProfile = async (candidateId: number, candidateName: string) => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/profile/download`);
      
      if (!response.ok) {
        if (response.status === 404) {
          alert('Candidate profile not found.');
          return;
        }
        throw new Error(`Failed to download profile: ${response.status}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${candidateName.replace(/\s+/g, '_')}_Profile_and_Resume.txt`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download profile. Please try again.');
    }
  };

  const getWorkAuthorizationDisplay = (auth: string) => {
    switch (auth) {
      case "citizen":
        return "US Citizen";
      case "green-card":
        return "Green Card";
      case "h1b":
        return "H1-B Visa";
      case "ead":
        return "EAD";
      default:
        return auth.charAt(0).toUpperCase() + auth.slice(1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No candidates found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {selectedCandidate && (
        <>
          <ResubmitDialog
            isOpen={isResubmitDialogOpen}
            onClose={() => setIsResubmitDialogOpen(false)}
            candidateId={selectedCandidate.id}
            candidateName={selectedCandidate.name}
          />
          <CandidateUnrealDialog 
            isOpen={isUnrealDialogOpen}
            onClose={() => setIsUnrealDialogOpen(false)}
            candidateId={selectedCandidate.id}
            candidateName={selectedCandidate.name}
            currentUnrealStatus={!!selectedCandidate.isUnreal}
            currentUnrealReason={selectedCandidate.unrealReason}
          />
        </>
      )}
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead className="hidden lg:table-cell">Job Title</TableHead>
            <TableHead className="hidden md:table-cell">Experience</TableHead>
            <TableHead className="hidden sm:table-cell">Date of Birth</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead className="hidden lg:table-cell">Work Authorization</TableHead>
            <TableHead className="hidden sm:table-cell">Created At</TableHead>
            <TableHead className="text-right w-[50px] max-w-[50px] pr-2"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow 
              key={candidate.id} 
              className="cursor-pointer border-border transition-colors duration-200 hover:bg-accent/5"
              onClick={() => handleViewCandidate(candidate.id)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {candidate.firstName} {candidate.middleName ? `${candidate.middleName} ` : ''}{candidate.lastName}
                  
                  {candidate.isUnreal && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive" className="ml-1.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>UNREAL</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px]">
                          <p>This candidate has been flagged as potentially unreal due to inconsistencies in employment history.</p>
                          {candidate.unrealReason && (
                            <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                              <span className="font-medium">Reason:</span> {candidate.unrealReason}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Show suspicious badge if candidate is flagged as suspicious */}
                  {candidate.isSuspicious && (
                    <SuspiciousBadge 
                      isSuspicious={!!candidate.isSuspicious}
                      suspiciousReason={candidate.suspiciousReason}
                      suspiciousSeverity={candidate.suspiciousSeverity}
                      size="sm"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">
                  {candidate.jobTitle || "Not specified"}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm font-medium">
                  {candidate.yearsOfExperience !== undefined 
                    ? `${candidate.yearsOfExperience}+ years` 
                    : "N/A"}
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {formatDob(candidate.dobMonth, candidate.dobDay)}
              </TableCell>
              <TableCell className="hidden md:table-cell">{candidate.location}</TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="text-sm">
                  <div>{candidate.email}</div>
                  <div className="text-muted-foreground">{candidate.phone}</div>
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {getWorkAuthorizationDisplay(candidate.workAuthorization)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">{formatDate(candidate.createdAt)}</TableCell>
              <TableCell className="text-right w-[50px] max-w-[50px] pr-2">
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionsDropdown
                    actions={[
                      {
                        label: "View",
                        icon: <Eye className="h-4 w-4" />,
                        onClick: () => handleViewCandidate(candidate.id)
                      },
                      {
                        label: "Download Resume",
                        icon: <Download className="h-4 w-4" />,
                        onClick: () => handleDownloadResume(candidate.id, `${candidate.firstName} ${candidate.lastName}`),
                        title: "Download original resume file",
                        variant: "success" as const
                      },
                      {
                        label: "Download Profile + Resume",
                        icon: <Download className="h-4 w-4" />,
                        onClick: () => handleDownloadProfile(candidate.id, `${candidate.firstName} ${candidate.lastName}`),
                        title: "Download candidate details with resume",
                        variant: "secondary" as const
                      },
                      {
                        label: "Resubmit", 
                        icon: <UploadCloud className="h-4 w-4" />,
                        onClick: () => handleResubmitCandidate(candidate.id, `${candidate.firstName} ${candidate.lastName}`),
                        variant: "success"
                      },
                      {
                        label: "Quick Submit",
                        icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>,
                        onClick: () => handleQuickSubmit(candidate.id, `${candidate.firstName} ${candidate.lastName}`),
                        variant: "success"
                      },
                      {
                        label: candidate.isUnreal ? "Validate" : "UNREAL",
                        icon: candidate.isUnreal 
                          ? <CheckCircle className="h-4 w-4" /> 
                          : <XCircle className="h-4 w-4" />,
                        onClick: () => handleToggleUnreal(
                          { stopPropagation: () => {} } as React.MouseEvent, 
                          candidate.id, 
                          `${candidate.firstName} ${candidate.lastName}`,
                          !!candidate.isUnreal,
                          candidate.unrealReason
                        ),
                        variant: candidate.isUnreal ? "success" : "destructive"
                      }
                    ]}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Resubmit Dialog */}
      {selectedCandidate && (
        <ResubmitDialog
          isOpen={isResubmitDialogOpen}
          onClose={() => {
            setIsResubmitDialogOpen(false);
            setSelectedCandidate(null);
          }}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.name}
        />
      )}

      {/* Quick Submit Dialog */}
      {selectedCandidate && (
        <QuickSubmitDialog
          isOpen={isQuickSubmitDialogOpen}
          onClose={() => {
            setIsQuickSubmitDialogOpen(false);
            setSelectedCandidate(null);
          }}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.name}
        />
      )}

      {/* Unreal Dialog */}
      {selectedCandidate && (
        <CandidateUnrealDialog
          isOpen={isUnrealDialogOpen}
          onClose={() => {
            setIsUnrealDialogOpen(false);
            setSelectedCandidate(null);
          }}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.name}
          isCurrentlyUnreal={selectedCandidate.isUnreal || false}
          currentUnrealReason={selectedCandidate.unrealReason || null}
        />
      )}
    </div>
  );
};

export default CandidateTable;
