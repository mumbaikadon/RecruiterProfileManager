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
  CheckCircle 
} from "lucide-react";
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
  candidates: Candidate[];
  isLoading?: boolean;
}

const CandidateTable: React.FC<CandidateTableProps> = ({ 
  candidates, 
  isLoading = false 
}) => {
  const [_, setLocation] = useLocation();
  const [isResubmitDialogOpen, setIsResubmitDialogOpen] = useState(false);
  const [isUnrealDialogOpen, setIsUnrealDialogOpen] = useState(false);
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
            <TableHead className="hidden sm:table-cell">Date of Birth</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead className="hidden lg:table-cell">Work Authorization</TableHead>
            <TableHead className="hidden sm:table-cell">Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell className="text-right">
                <div className="flex justify-end space-x-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewCandidate(candidate.id);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-green-600 hover:text-green-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResubmitCandidate(candidate.id, `${candidate.firstName} ${candidate.lastName}`);
                    }}
                  >
                    <UploadCloud className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Resubmit</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={candidate.isUnreal 
                      ? "text-green-600 hover:text-green-700 transition-colors" 
                      : "text-red-600 hover:text-red-700 transition-colors"
                    }
                    onClick={(e) => handleToggleUnreal(
                      e, 
                      candidate.id, 
                      `${candidate.firstName} ${candidate.lastName}`,
                      !!candidate.isUnreal,
                      candidate.unrealReason
                    )}
                  >
                    {candidate.isUnreal 
                      ? <CheckCircle className="h-4 w-4 mr-1" /> 
                      : <XCircle className="h-4 w-4 mr-1" />
                    }
                    <span className="hidden sm:inline">
                      {candidate.isUnreal ? "Validate" : "UNREAL"}
                    </span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CandidateTable;
