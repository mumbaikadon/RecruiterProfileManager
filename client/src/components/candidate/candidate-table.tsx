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
      <div className="text-center py-8 text-gray-500">
        No candidates found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date of Birth</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Work Authorization</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow 
              key={candidate.id} 
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => handleViewCandidate(candidate.id)}
            >
              <TableCell className="font-medium">
                {candidate.firstName} {candidate.middleName ? `${candidate.middleName} ` : ''}{candidate.lastName}
              </TableCell>
              <TableCell>
                {formatDob(candidate.dobMonth, candidate.dobDay)}
              </TableCell>
              <TableCell>{candidate.location}</TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{candidate.email}</div>
                  <div className="text-gray-500">{candidate.phone}</div>
                </div>
              </TableCell>
              <TableCell>
                {getWorkAuthorizationDisplay(candidate.workAuthorization)}
              </TableCell>
              <TableCell>{formatDate(candidate.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewCandidate(candidate.id);
                  }}
                >
                  View
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
