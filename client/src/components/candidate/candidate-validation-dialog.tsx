import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, AlertTriangle, GitCompareArrows } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CandidateValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName?: string;
  jobId: number;
  jobTitle?: string;
  existingResumeData: {
    id: number;
    clientNames: string[];
    jobTitles: string[];
    relevantDates: string[];
  };
  newResumeData: {
    clientNames: string[];
    jobTitles: string[];
    relevantDates: string[];
  };
  validationType: "resubmission";
  resumeFileName?: string;
  validateCandidate: (validationData: {
    candidateId: number;
    jobId: number;
    validationType: string;
    validationResult: "matching" | "unreal";
    previousClientNames: string[];
    previousJobTitles: string[];
    previousDates: string[];
    newClientNames: string[];
    newJobTitles: string[];
    newDates: string[];
    resumeFileName?: string;
    reason?: string;
  }) => Promise<any>;
  validatedBy: number;
}

const CandidateValidationDialog: React.FC<CandidateValidationDialogProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName = "Candidate",
  jobId,
  jobTitle = "This job",
  existingResumeData,
  newResumeData,
  validationType,
  resumeFileName,
  validateCandidate,
  validatedBy
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<"matching" | "unreal" | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate discrepancies between the existing and new resume data
  const comparisonData = {
    companies: {
      added: newResumeData.clientNames.filter(name => !existingResumeData.clientNames.includes(name)),
      removed: existingResumeData.clientNames.filter(name => !newResumeData.clientNames.includes(name)),
      unchanged: existingResumeData.clientNames.filter(name => newResumeData.clientNames.includes(name))
    },
    titles: {
      added: newResumeData.jobTitles.filter(title => !existingResumeData.jobTitles.includes(title)),
      removed: existingResumeData.jobTitles.filter(title => !newResumeData.jobTitles.includes(title)),
      unchanged: existingResumeData.jobTitles.filter(title => newResumeData.jobTitles.includes(title))
    },
    dates: {
      added: newResumeData.relevantDates.filter(date => !existingResumeData.relevantDates.includes(date)),
      removed: existingResumeData.relevantDates.filter(date => !newResumeData.relevantDates.includes(date)),
      unchanged: existingResumeData.relevantDates.filter(date => newResumeData.relevantDates.includes(date))
    }
  };

  // Calculate inconsistency score as a percentage
  const calcDiscrepancyScore = () => {
    const totalOriginalItems = 
      existingResumeData.clientNames.length + 
      existingResumeData.jobTitles.length + 
      existingResumeData.relevantDates.length;
    
    const totalChangedItems = 
      comparisonData.companies.added.length + 
      comparisonData.companies.removed.length +
      comparisonData.titles.added.length +
      comparisonData.titles.removed.length +
      comparisonData.dates.added.length +
      comparisonData.dates.removed.length;
    
    if (totalOriginalItems === 0) return 0;
    return Math.round((totalChangedItems / (totalOriginalItems * 2)) * 100);
  };

  const discrepancyScore = calcDiscrepancyScore();
  const hasDiscrepancies = discrepancyScore > 10; // More than 10% changes is considered significant

  const handleValidate = async (result: "matching" | "unreal") => {
    if (result === "unreal" && !reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason when marking a candidate as unreal",
        variant: "destructive",
      });
      return;
    }

    setValidationResult(result);
    setIsPending(true);
    setValidationError(null);

    try {
      await validateCandidate({
        candidateId,
        jobId,
        validationType,
        validationResult: result,
        previousClientNames: existingResumeData.clientNames,
        previousJobTitles: existingResumeData.jobTitles,
        previousDates: existingResumeData.relevantDates,
        newClientNames: newResumeData.clientNames,
        newJobTitles: newResumeData.jobTitles,
        newDates: newResumeData.relevantDates,
        resumeFileName,
        reason: result === "unreal" ? reason : undefined
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });

      toast({
        title: result === "matching" ? "Candidate validated" : "Candidate marked as unreal",
        description: result === "matching" 
          ? `${candidateName} has been validated and submitted for ${jobTitle}`
          : `${candidateName} has been marked as potentially fraudulent and will require additional verification for future submissions.`,
      });

      onClose();
    } catch (error) {
      console.error("Validation error:", error);
      setValidationError(error instanceof Error ? error.message : "Failed to validate candidate");
      toast({
        title: "Validation failed",
        description: error instanceof Error ? error.message : "Failed to validate candidate",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-amber-500" />
            Candidate Employment History Validation
          </DialogTitle>
          <DialogDescription>
            Compare employment history information for {candidateName} before submission to {jobTitle}
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
            {validationError}
          </div>
        )}

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Discrepancy Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Comparing previous and new resume data
              </p>
            </div>
            <div className="flex items-center">
              <Badge 
                variant={hasDiscrepancies ? "destructive" : "outline"} 
                className={cn(
                  "text-md py-1 px-3",
                  hasDiscrepancies ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-green-100 text-green-800 hover:bg-green-100"
                )}
              >
                {hasDiscrepancies ? (
                  <AlertTriangle className="mr-1 h-4 w-4" />
                ) : (
                  <CheckCircle className="mr-1 h-4 w-4" />
                )}
                {discrepancyScore}% Discrepancy
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Previous Employment Data */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-700">Previous Employment History</CardTitle>
                <CardDescription>Data from candidate's existing record</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Companies/Clients:</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {existingResumeData.clientNames.length > 0 ? (
                      existingResumeData.clientNames.map((name, idx) => (
                        <li key={`prev-company-${idx}`} className="mb-1">
                          {name}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No companies listed</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Job Titles:</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {existingResumeData.jobTitles.length > 0 ? (
                      existingResumeData.jobTitles.map((title, idx) => (
                        <li key={`prev-title-${idx}`} className="mb-1">
                          {title}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No job titles listed</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Employment Dates:</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {existingResumeData.relevantDates.length > 0 ? (
                      existingResumeData.relevantDates.map((date, idx) => (
                        <li key={`prev-date-${idx}`} className="mb-1">
                          {date}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No dates listed</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* New Employment Data */}
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-700">Current Submission Data</CardTitle>
                <CardDescription>Data from candidate's new resume</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Companies/Clients:</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {newResumeData.clientNames.length > 0 ? (
                      newResumeData.clientNames.map((name, idx) => (
                        <li 
                          key={`new-company-${idx}`} 
                          className={cn(
                            "mb-1",
                            comparisonData.companies.added.includes(name) && "text-green-600 font-medium"
                          )}
                        >
                          {name}
                          {comparisonData.companies.added.includes(name) && " (New)"}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No companies listed</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Job Titles:</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {newResumeData.jobTitles.length > 0 ? (
                      newResumeData.jobTitles.map((title, idx) => (
                        <li 
                          key={`new-title-${idx}`} 
                          className={cn(
                            "mb-1",
                            comparisonData.titles.added.includes(title) && "text-green-600 font-medium"
                          )}
                        >
                          {title}
                          {comparisonData.titles.added.includes(title) && " (New)"}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No job titles listed</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Employment Dates:</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {newResumeData.relevantDates.length > 0 ? (
                      newResumeData.relevantDates.map((date, idx) => (
                        <li 
                          key={`new-date-${idx}`} 
                          className={cn(
                            "mb-1",
                            comparisonData.dates.added.includes(date) && "text-green-600 font-medium"
                          )}
                        >
                          {date}
                          {comparisonData.dates.added.includes(date) && " (New)"}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No dates listed</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Missing items from previous resume */}
          {(comparisonData.companies.removed.length > 0 || 
            comparisonData.titles.removed.length > 0 || 
            comparisonData.dates.removed.length > 0) && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Missing Information
                </CardTitle>
                <CardDescription>Items present in the previous resume but missing in the new one</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comparisonData.companies.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Missing Companies/Clients:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {comparisonData.companies.removed.map((name, idx) => (
                        <li key={`missing-company-${idx}`} className="mb-1 text-red-600">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {comparisonData.titles.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Missing Job Titles:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {comparisonData.titles.removed.map((title, idx) => (
                        <li key={`missing-title-${idx}`} className="mb-1 text-red-600">
                          {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {comparisonData.dates.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Missing Employment Dates:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {comparisonData.dates.removed.map((date, idx) => (
                        <li key={`missing-date-${idx}`} className="mb-1 text-red-600">
                          {date}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {validationResult === "unreal" && (
            <div className="space-y-3">
              <h3 className="text-base font-medium">Reason for marking as unreal</h3>
              <Textarea
                placeholder="Provide details about why this candidate is being marked as unreal..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setValidationResult(validationResult === "unreal" ? null : "unreal")}
              disabled={isPending}
              className={validationResult === "unreal" ? "bg-gray-400 hover:bg-gray-500" : ""}
            >
              {validationResult === "unreal" ? "Cancel Unreal" : "Mark as Unreal"}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => handleValidate(validationResult === "unreal" ? "unreal" : "matching")}
              disabled={isPending}
            >
              {isPending 
                ? "Processing..." 
                : validationResult === "unreal" 
                  ? "Confirm Unreal" 
                  : "Validate & Submit"
              }
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateValidationDialog;