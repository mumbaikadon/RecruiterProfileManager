import React from "react";
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
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface CandidateTableProps {
  candidates: Candidate[];
  isLoading?: boolean;
}

const CandidateTable: React.FC<CandidateTableProps> = ({ 
  candidates, 
  isLoading = false 
}) => {
  const [_, setLocation] = useLocation();

  const handleViewCandidate = (id: number) => {
    setLocation(`/candidates/${id}`);
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
                {candidate.firstName} {candidate.middleName ? `${candidate.middleName} ` : ''}{candidate.lastName}
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CandidateTable;
