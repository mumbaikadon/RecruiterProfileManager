import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, MapPin, Award, Briefcase } from "lucide-react";

interface CandidateRecommendation {
  candidateId: number;
  candidateName: string;
  location: string;
  matchScore: number;
  matchReasons: string[];
  skillMatches: string[];
  locationMatch: string;
  clientExperience: string | null;
}

interface RecommendedCandidatesProps {
  jobId: number;
  onSubmitCandidate?: (candidateId: number) => void;
}

export function RecommendedCandidates({ jobId, onSubmitCandidate }: RecommendedCandidatesProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);

  // Fetch recommended candidates
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['/api/jobs', jobId, 'recommended-candidates'],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}/recommended-candidates`);
      if (!response.ok) {
        throw new Error('Failed to fetch recommended candidates');
      }
      return response.json() as Promise<CandidateRecommendation[]>;
    },
    enabled: !!jobId,
  });

  // Helper to get badge color based on match score
  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-emerald-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 45) return "bg-yellow-500";
    return "bg-gray-500";
  };
  
  // Helper to determine if candidate is a "Perfect Match"
  const isPerfectMatch = (candidate: CandidateRecommendation) => {
    return candidate.matchScore >= 90;
  };

  // Handle submitting a candidate
  const handleSubmitCandidate = (candidateId: number) => {
    if (onSubmitCandidate) {
      onSubmitCandidate(candidateId);
    } else {
      toast({
        title: "Candidate Selected",
        description: `Candidate ID: ${candidateId} has been selected for submission.`,
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recommended Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 border rounded-md">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-10 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recommended Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-center text-gray-500">
            <div>
              <AlertCircle className="mx-auto h-10 w-10 text-orange-500 mb-2" />
              <p>Failed to load candidate recommendations</p>
              <p className="text-sm mt-1">
                {error instanceof Error ? error.message : "Please try again later"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recommended Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-center text-gray-500">
            <div>
              <p>No matching candidates found</p>
              <p className="text-sm mt-1">
                Consider broadening the job requirements or adding more candidates to the database
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Award className="mr-2 h-5 w-5 text-yellow-500" />
          Recommended Candidates
          <span className="text-sm ml-2 font-normal text-gray-500">
            ({data.length} match{data.length !== 1 ? "es" : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((candidate) => (
            <div 
              key={candidate.candidateId}
              className={`border rounded-lg transition-all overflow-hidden ${
                expanded === candidate.candidateId ? "shadow-md" : ""
              }`}
            >
              {/* Candidate header - always visible */}
              <div className="p-4 flex items-center justify-between bg-gray-50 cursor-pointer"
                   onClick={() => setExpanded(expanded === candidate.candidateId ? null : candidate.candidateId)}>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${getMatchScoreColor(candidate.matchScore)}`}>
                      {candidate.matchScore}%
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 flex items-center">
                      {candidate.candidateName}
                      {isPerfectMatch(candidate) && (
                        <Badge className="ml-2 bg-green-500">Perfect Match</Badge>
                      )}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="h-3.5 w-3.5 mr-1" />
                      {candidate.location}
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubmitCandidate(candidate.candidateId);
                  }}
                >
                  Submit
                </Button>
              </div>
              
              {/* Expanded details */}
              {expanded === candidate.candidateId && (
                <div className="p-4 border-t">
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-1.5">Match Score</h4>
                    <div className="flex items-center gap-2">
                      <Progress value={candidate.matchScore} className="h-2" />
                      <span className="text-sm font-medium">{candidate.matchScore}%</span>
                    </div>
                  </div>
                  
                  {candidate.matchReasons.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1.5">Match Reasons</h4>
                      <ul className="text-sm space-y-1">
                        {candidate.matchReasons.map((reason, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-1.5 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.skillMatches.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1.5">Matching Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.skillMatches.map((skill, index) => (
                          <Badge key={index} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {candidate.clientExperience && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1.5">Previous Client Experience</h4>
                      <div className="flex items-center">
                        <Briefcase className="h-4 w-4 text-blue-500 mr-1.5" />
                        <span className="text-sm">{candidate.clientExperience}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}