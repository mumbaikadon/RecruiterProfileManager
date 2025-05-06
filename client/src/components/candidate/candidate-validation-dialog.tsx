import React, { useState, useEffect } from "react";
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
import { AlertCircle, CheckCircle, AlertTriangle, GitCompareArrows, Users, Fingerprint, Building, Briefcase, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

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
    education?: string[];
  };
  newResumeData: {
    clientNames: string[];
    jobTitles: string[];
    relevantDates: string[];
    education?: string[];
  };
  validationType: "resubmission";
  resumeFileName?: string;
  // Suspicious flags preloaded from previous validations or detections
  isSuspicious?: boolean;
  suspiciousReason?: string;
  suspiciousSeverity?: "LOW" | "MEDIUM" | "HIGH";
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
    // Add suspicious flags
    isSuspicious?: boolean;
    suspiciousReason?: string;
    suspiciousSeverity?: "LOW" | "MEDIUM" | "HIGH";
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
  // Add suspicious flag props with defaults
  isSuspicious = false,
  suspiciousReason,
  suspiciousSeverity,
  validateCandidate,
  validatedBy
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<"matching" | "unreal" | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isCheckingEmployment, setIsCheckingEmployment] = useState(false);
  const [employmentValidation, setEmploymentValidation] = useState<{
    hasSimilarHistories: boolean;
    hasIdenticalChronology: boolean;
    highSimilarityMatches: Array<{
      candidateId: number;
      candidateName: string;
      candidateEmail: string;
      similarityScore: number;
      clientNames: string[];
      relevantDates: string[];
    }>;
    identicalChronologyMatches: Array<{
      candidateId: number;
      candidateName: string;
      candidateEmail: string;
      similarityScore: number;
      clientNames: string[];
      relevantDates: string[];
    }>;
    totalCandidatesChecked: number;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check for similar employment histories when the dialog opens
  useEffect(() => {
    if (isOpen && newResumeData.clientNames.length > 0) {
      checkSimilarEmploymentHistories();
    }
  }, [isOpen, newResumeData.clientNames]);
  
  // Function to check for similar employment histories
  const checkSimilarEmploymentHistories = async () => {
    if (newResumeData.clientNames.length === 0) {
      return; // No companies to check
    }
    
    setIsCheckingEmployment(true);
    try {
      console.log("Sending similar employment histories check request with data:", {
        candidateId,
        clientNames: newResumeData.clientNames,
        relevantDates: newResumeData.relevantDates
      });
      
      const responseData = await apiRequest<{
        message: string;
        hasSimilarHistories: boolean;
        hasIdenticalChronology: boolean;
        highSimilarityMatches: Array<{
          candidateId: number;
          candidateName: string;
          candidateEmail: string;
          similarityScore: number;
          clientNames: string[];
          relevantDates: string[];
        }>;
        identicalChronologyMatches: Array<{
          candidateId: number;
          candidateName: string;
          candidateEmail: string;
          similarityScore: number;
          clientNames: string[];
          relevantDates: string[];
        }>;
        totalCandidatesChecked: number;
        suspiciousPatterns?: Array<{
          type: string;
          severity: string;
          message: string;
          detail: string;
        }>
      }>('/api/candidates/check-similar-employment', {
        method: 'POST',
        body: JSON.stringify({
          candidateId,
          clientNames: newResumeData.clientNames,
          relevantDates: newResumeData.relevantDates
        })
      });
      
      console.log("Employment history validation response:", responseData);
      setEmploymentValidation({
        ...responseData,
        hasIdenticalChronology: responseData.identicalChronologyMatches?.length > 0 || responseData.hasIdenticalChronology || false,
        hasSimilarHistories: responseData.highSimilarityMatches?.length > 0 || responseData.hasSimilarHistories || false,
      });
      
      // Log detailed match information
      if (responseData.identicalChronologyMatches?.length > 0) {
        console.log("IDENTICAL CHRONOLOGY MATCHES:", responseData.identicalChronologyMatches);
      }
      
      if (responseData.highSimilarityMatches?.length > 0) {
        console.log("HIGH SIMILARITY MATCHES:", responseData.highSimilarityMatches);
      }
      
      // If there are suspicious patterns, automatically set a reason
      if (responseData.identicalChronologyMatches?.length > 0) {
        // Get up to 3 candidate names to show in the reason
        const matchedNames = responseData.identicalChronologyMatches
          .filter(Boolean)
          .slice(0, 3)
          .map(match => match.candidateName)
          .join(', ');
          
        const additionalCandidates = responseData.identicalChronologyMatches.length > 3 
          ? ` and ${responseData.identicalChronologyMatches.length - 3} other(s)` 
          : '';
          
        setReason(prev => prev || `CRITICAL: Identical job chronology detected with ${matchedNames}${additionalCandidates}. Same companies and dates found.`);
        console.log(`Setting reason: Identical chronology detected with ${responseData.identicalChronologyMatches.length} candidates`);
      } else if (responseData.highSimilarityMatches?.length > 0) {
        // Get up to 3 candidate names to show in the reason
        const matchedNames = responseData.highSimilarityMatches
          .filter(Boolean)
          .slice(0, 3)
          .map(match => match.candidateName)
          .join(', ');
          
        const additionalCandidates = responseData.highSimilarityMatches.length > 3 
          ? ` and ${responseData.highSimilarityMatches.length - 3} other(s)` 
          : '';
          
        setReason(prev => prev || `WARNING: High similarity detected with ${matchedNames}${additionalCandidates}. Employment history has ${responseData.highSimilarityMatches[0]?.similarityScore}% match.`);
        console.log(`Setting reason: High similarity detected with ${responseData.highSimilarityMatches.length} candidates`);
      }
    } catch (error) {
      console.error("Error checking similar employment histories:", error);
      toast({
        title: "Validation Warning",
        description: "Unable to check for similar employment histories. You can still proceed with validation.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEmployment(false);
    }
  };

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
    },
    education: {
      added: (newResumeData.education || []).filter(edu => !(existingResumeData.education || []).includes(edu)),
      removed: (existingResumeData.education || []).filter(edu => !(newResumeData.education || []).includes(edu)),
      unchanged: (existingResumeData.education || []).filter(edu => (newResumeData.education || []).includes(edu))
    }
  };

  // Calculate inconsistency score as a percentage
  const calcDiscrepancyScore = () => {
    const totalOriginalItems = 
      existingResumeData.clientNames.length + 
      existingResumeData.jobTitles.length + 
      existingResumeData.relevantDates.length +
      (existingResumeData.education?.length || 0);
    
    const totalChangedItems = 
      comparisonData.companies.added.length + 
      comparisonData.companies.removed.length +
      comparisonData.titles.added.length +
      comparisonData.titles.removed.length +
      comparisonData.dates.added.length +
      comparisonData.dates.removed.length +
      comparisonData.education.added.length +
      comparisonData.education.removed.length;
    
    if (totalOriginalItems === 0) return 0;
    return Math.round((totalChangedItems / (totalOriginalItems * 2)) * 100);
  };

  const discrepancyScore = calcDiscrepancyScore();
  const hasDiscrepancies = discrepancyScore > 10; // More than 10% changes is considered significant

  const handleValidate = async (result: "matching" | "unreal") => {
    console.log("Validation dialog: handleValidate called with result:", result);
    
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
      // Determine if we should flag the submission as suspicious based on both props and validation results
      const isNewlySuspicious = result === "matching" && (
        employmentValidation?.hasIdenticalChronology || 
        employmentValidation?.hasSimilarHistories
      );
      
      // Combine existing suspicious status from props with any new findings
      // If it was already marked as suspicious or newly found to be suspicious, keep it flagged
      const isSuspiciousFlag = isSuspicious || isNewlySuspicious;
      
      // Use either the existing reason or generate a new one if newly suspicious
      const suspiciousReasonToUse = suspiciousReason || (isNewlySuspicious 
        ? (employmentValidation?.hasIdenticalChronology 
          ? `Identical job chronology with ${employmentValidation.identicalChronologyMatches.length} other candidate(s)` 
          : `Similar employment history (>${employmentValidation?.highSimilarityMatches[0]?.similarityScore}%) with ${employmentValidation?.highSimilarityMatches.length} other candidate(s)`)
        : undefined);
      
      // Use the most severe classification - if existing is HIGH, keep it, otherwise use new severity if available
      let suspiciousSeverityToUse = suspiciousSeverity;
      if (isNewlySuspicious) {
        const newSeverity = employmentValidation?.hasIdenticalChronology ? "HIGH" : "MEDIUM";
        // If existing severity is not HIGH or there's no existing severity, use the new severity
        if (suspiciousSeverityToUse !== "HIGH") {
          suspiciousSeverityToUse = newSeverity;
        }
      }
      
      // Log validation data being sent
      console.log("Sending validation data:", {
        candidateId,
        jobId,
        validationType,
        validationResult: result,
        previousData: {
          clientNames: existingResumeData.clientNames.length,
          jobTitles: existingResumeData.jobTitles.length,
          dates: existingResumeData.relevantDates.length,
          education: existingResumeData.education?.length || 0
        },
        newData: {
          clientNames: newResumeData.clientNames.length,
          jobTitles: newResumeData.jobTitles.length,
          dates: newResumeData.relevantDates.length,
          education: newResumeData.education?.length || 0
        },
        reason: result === "unreal" ? reason : undefined,
        isSuspicious: isSuspiciousFlag,
        suspiciousReason: suspiciousReasonToUse,
        suspiciousSeverity: suspiciousSeverityToUse
      });
      
      // Prepare the validation data with suspicious flags if needed
      const validationData = {
        candidateId,
        jobId,
        validationType,
        validationResult: result,
        previousClientNames: existingResumeData.clientNames,
        previousJobTitles: existingResumeData.jobTitles,
        previousDates: existingResumeData.relevantDates,
        previousEducation: existingResumeData.education || [],
        newClientNames: newResumeData.clientNames,
        newJobTitles: newResumeData.jobTitles,
        newDates: newResumeData.relevantDates,
        newEducation: newResumeData.education || [],
        resumeFileName,
        reason: result === "unreal" ? reason : undefined,
        validatedBy, // Use validatedBy from props
        // Add suspicious flags directly as properties with the processed values
        isSuspicious: isSuspiciousFlag,
        suspiciousReason: suspiciousReasonToUse,
        suspiciousSeverity: suspiciousSeverityToUse
      };
      
      // Log suspicious data for debugging
      if (isSuspiciousFlag) {
        console.log("Including suspicious flags in validation request:", {
          isSuspicious: isSuspiciousFlag,
          suspiciousReason: suspiciousReasonToUse,
          suspiciousSeverity: suspiciousSeverityToUse
        });
      }
      
      await validateCandidate(validationData);
      console.log("Validation successful, result:", result);

      // Invalidate relevant queries
      console.log("Invalidating related queries for candidateId:", candidateId);
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
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto rounded-xl shadow-lg">
        <DialogHeader className="space-y-3 pb-3 mb-3 border-b dark:border-slate-700">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-full bg-gradient-to-r from-blue-50 to-amber-50 dark:from-blue-900/20 dark:to-amber-900/20">
              <GitCompareArrows className="h-6 w-6 text-amber-500 dark:text-amber-400" />
            </div>
            <span className="bg-gradient-to-r from-blue-600 to-amber-600 dark:from-blue-400 dark:to-amber-400 text-transparent bg-clip-text">
              Employment History Validation
            </span>
          </DialogTitle>
          <DialogDescription className="text-base opacity-90">
            Comparing data for <span className="font-medium">{candidateName}</span> before submission to <span className="font-medium text-primary dark:text-primary-foreground">{jobTitle}</span>
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-5 py-4 rounded-lg mb-5 shadow-sm flex items-start">
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
        
        {/* Employment history validation warnings */}
        {isCheckingEmployment && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-5 py-4 rounded-lg mb-5 shadow-sm flex items-start">
            <div className="animate-spin mr-3 h-5 w-5 text-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <span>Checking for similar employment histories across candidates...</span>
          </div>
        )}
        
        {employmentValidation?.hasIdenticalChronology && (
          <Alert variant="destructive" className="mb-5 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300">
            <Fingerprint className="h-5 w-5" />
            <AlertTitle className="font-bold text-lg flex items-center gap-2">
              <span className="p-1 bg-red-100 dark:bg-red-800 rounded-full">
                <AlertTriangle className="h-4 w-4" />
              </span>
              🚩 CRITICAL: Identical Job Chronology Detected
            </AlertTitle>
            <AlertDescription className="mt-1">
              <p className="mb-2">Found <span className="font-bold">{employmentValidation.identicalChronologyMatches.length}</span> other candidate(s) with identical job chronology (same companies and dates). This pattern strongly suggests resume fraud.</p>
              
              {employmentValidation.suspiciousPatterns?.filter(p => p.type === "IDENTICAL_CHRONOLOGY").map((pattern, idx) => (
                <div key={idx} className="bg-red-50 dark:bg-red-900/30 p-3 rounded-md mb-3 border border-red-200 dark:border-red-800">
                  <p className="font-medium">{pattern.message}</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{pattern.detail}</p>
                </div>
              ))}
              
              <div className="bg-white dark:bg-slate-800 rounded-md p-3 mt-2 max-h-48 overflow-y-auto border border-red-200 dark:border-red-800">
                {employmentValidation.identicalChronologyMatches.map((match, idx) => (
                  <div key={match.candidateId} className={cn("flex flex-col p-2", idx !== 0 && "border-t border-red-100 dark:border-red-900 mt-2 pt-2")}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-red-700 dark:text-red-400">{match.candidateName}</span>
                      <Badge variant="outline" className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                        {match.similarityScore}% Match
                      </Badge>
                    </div>
                    <span className="text-sm text-red-600/80 dark:text-red-400/80">{match.candidateEmail || 'No email'}</span>
                    <div className="mt-1 text-xs text-red-600/70 dark:text-red-400/70">
                      <p><span className="font-medium">Companies:</span> {match.clientNames.join(", ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {!employmentValidation?.hasIdenticalChronology && employmentValidation?.hasSimilarHistories && (
          <Alert variant="destructive" className="mb-5 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
            <Users className="h-5 w-5" />
            <AlertTitle className="font-bold text-lg flex items-center gap-2">
              <span className="p-1 bg-amber-100 dark:bg-amber-800 rounded-full">
                <AlertTriangle className="h-4 w-4" />
              </span>
              ⚠️ WARNING: High Similarity Detected
            </AlertTitle>
            <AlertDescription className="mt-1">
              <p className="mb-2">Found <span className="font-bold">{employmentValidation.highSimilarityMatches.length}</span> other candidate(s) with &gt;80% similar employment history. This requires additional verification.</p>
              
              {employmentValidation.suspiciousPatterns?.filter(p => p.type === "HIGH_SIMILARITY").map((pattern, idx) => (
                <div key={idx} className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-md mb-3 border border-amber-200 dark:border-amber-800">
                  <p className="font-medium">{pattern.message}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{pattern.detail}</p>
                </div>
              ))}
              
              <div className="bg-white dark:bg-slate-800 rounded-md p-3 mt-2 max-h-48 overflow-y-auto border border-amber-200 dark:border-amber-800">
                {employmentValidation.highSimilarityMatches.map((match, idx) => (
                  <div key={match.candidateId} className={cn("flex flex-col p-2", idx !== 0 && "border-t border-amber-100 dark:border-amber-900 mt-2 pt-2")}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{match.candidateName}</span>
                      <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                        {match.similarityScore}% Match
                      </Badge>
                    </div>
                    <span className="text-sm text-amber-600/80 dark:text-amber-400/80">{match.candidateEmail || 'No email'}</span>
                    <div className="mt-1 text-xs text-amber-600/70 dark:text-amber-400/70">
                      <p><span className="font-medium">Companies:</span> {match.clientNames.join(", ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-xl font-medium tracking-tight flex items-center gap-2">
                <GitCompareArrows className="h-5 w-5 text-primary" />
                Discrepancy Analysis
              </h3>
              <p className="text-base text-muted-foreground mt-1">
                Analyzing changes between resume versions
              </p>
            </div>
            <div className="flex items-center">
              <Badge 
                variant={hasDiscrepancies ? "destructive" : "outline"} 
                className={cn(
                  "text-lg font-semibold py-2 px-4 shadow-sm transition-all duration-300 ease-in-out",
                  hasDiscrepancies 
                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/40 border-red-300 dark:border-red-800" 
                    : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/40 border-green-300 dark:border-green-800"
                )}
              >
                <div className="flex items-center gap-2">
                  {hasDiscrepancies ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  <span>{discrepancyScore}% Discrepancy</span>
                </div>
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Previous Employment Data */}
            <Card className="rounded-xl overflow-hidden shadow-md border-0 transition-all duration-300 hover:shadow-lg">
              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 dark:from-blue-900/20 dark:to-blue-800/30 px-6 py-4 border-b border-blue-100 dark:border-blue-900">
                <CardTitle className="flex items-center gap-2 text-lg text-blue-800 dark:text-blue-300 mb-1">
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-full">
                    <Clock className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                  </div>
                  Previous Candidate Data
                </CardTitle>
                <CardDescription className="text-blue-700/70 dark:text-blue-400/80">
                  Data from candidate's existing record
                </CardDescription>
              </div>
              <CardContent className="p-5 bg-white dark:bg-slate-800 space-y-6">
                {/* Employment history section */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    Employment History
                  </h3>
                
                  {existingResumeData.clientNames.length > 0 ? (
                    <div className="space-y-5">
                      {existingResumeData.clientNames.map((name, idx) => (
                        <div key={`prev-company-${idx}`} className="bg-blue-50 dark:bg-slate-700/30 p-3 rounded-lg border border-blue-100 dark:border-slate-700 transition-all duration-300 hover:shadow-sm hover:border-blue-200 dark:hover:border-slate-600">
                          <div className="flex items-center gap-2 mb-2">
                            <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <h4 className="font-medium text-blue-900 dark:text-blue-300">{name}</h4>
                          </div>
                          <div className="pl-6 text-sm">
                            <p className="font-medium text-slate-700 dark:text-slate-300">
                              {idx < existingResumeData.jobTitles.length ? existingResumeData.jobTitles[idx] : "Position not specified"}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                              {idx < existingResumeData.relevantDates.length ? existingResumeData.relevantDates[idx] : "Dates not specified"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 bg-blue-50/50 dark:bg-slate-700/20 rounded-lg border border-blue-100/50 dark:border-slate-700/50">
                      <Briefcase className="h-12 w-12 mx-auto mb-3 text-blue-200 dark:text-slate-600" />
                      <p className="font-medium">No employment history information</p>
                      <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">No previous employment records available.</p>
                    </div>
                  )}
                </div>
                
                {/* Education section */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Educational Background
                  </h3>
                
                  {existingResumeData.education && existingResumeData.education.length > 0 ? (
                    <div className="space-y-3">
                      {existingResumeData.education.map((edu, idx) => (
                        <div key={`prev-edu-${idx}`} className="bg-blue-50 dark:bg-slate-700/30 p-3 rounded-lg border border-blue-100 dark:border-slate-700 transition-all duration-300 hover:shadow-sm hover:border-blue-200 dark:hover:border-slate-600">
                          <p className="text-blue-900 dark:text-blue-300">{edu}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 bg-blue-50/50 dark:bg-slate-700/20 rounded-lg border border-blue-100/50 dark:border-slate-700/50">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-blue-200 dark:text-slate-600" />
                      <p className="font-medium">No education information</p>
                      <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">No previous education records available.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* New Employment Data */}
            <Card className="rounded-xl overflow-hidden shadow-md border-0 transition-all duration-300 hover:shadow-lg">
              <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 dark:from-amber-900/20 dark:to-amber-800/30 px-6 py-4 border-b border-amber-100 dark:border-amber-900">
                <CardTitle className="flex items-center gap-2 text-lg text-amber-800 dark:text-amber-300 mb-1">
                  <div className="bg-amber-100 dark:bg-amber-900/50 p-1.5 rounded-full">
                    <FileText className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  </div>
                  Current Submission Data
                </CardTitle>
                <CardDescription className="text-amber-700/70 dark:text-amber-400/80">
                  Data from candidate's new resume
                </CardDescription>
              </div>
              <CardContent className="p-5 bg-white dark:bg-slate-800 space-y-6">
                {/* Employment history section */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    Employment History
                  </h3>
                
                  {newResumeData.clientNames.length > 0 ? (
                    <div className="space-y-5">
                      {newResumeData.clientNames.map((name, idx) => (
                        <div 
                          key={`new-company-${idx}`} 
                          className={cn(
                            "bg-amber-50 dark:bg-slate-700/30 p-3 rounded-lg border border-amber-100 dark:border-slate-700 transition-all duration-300 hover:shadow-sm",
                            comparisonData.companies.added.includes(name) && "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <h4 className={cn(
                                "font-medium text-amber-900 dark:text-amber-300",
                                comparisonData.companies.added.includes(name) && "text-green-700 dark:text-green-400"
                              )}>
                                {name}
                              </h4>
                            </div>
                            {comparisonData.companies.added.includes(name) && (
                              <Badge variant="outline" className="text-xs bg-green-100/50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="pl-6 text-sm">
                            <p className={cn(
                              "font-medium text-slate-700 dark:text-slate-300",
                              idx < newResumeData.jobTitles.length && comparisonData.titles.added.includes(newResumeData.jobTitles[idx]) && "text-green-700 dark:text-green-400"
                            )}>
                              {idx < newResumeData.jobTitles.length ? newResumeData.jobTitles[idx] : "Position not specified"}
                              {idx < newResumeData.jobTitles.length && comparisonData.titles.added.includes(newResumeData.jobTitles[idx]) && (
                                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-1.5 py-0.5 rounded">New</span>
                              )}
                            </p>
                            <p className={cn(
                              "text-slate-500 dark:text-slate-400 mt-1 text-sm", 
                              idx < newResumeData.relevantDates.length && comparisonData.dates.added.includes(newResumeData.relevantDates[idx]) && "text-green-700 dark:text-green-400"
                            )}>
                              {idx < newResumeData.relevantDates.length ? newResumeData.relevantDates[idx] : "Dates not specified"}
                              {idx < newResumeData.relevantDates.length && comparisonData.dates.added.includes(newResumeData.relevantDates[idx]) && (
                                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-1.5 py-0.5 rounded">New</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 bg-amber-50/50 dark:bg-slate-700/20 rounded-lg border border-amber-100/50 dark:border-slate-700/50">
                      <Briefcase className="h-12 w-12 mx-auto mb-3 text-amber-200 dark:text-slate-600" />
                      <p className="font-medium">No employment history information</p>
                      <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">No employment data found in new resume.</p>
                    </div>
                  )}
                </div>
                
                {/* Education section */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Educational Background
                  </h3>
                
                  {newResumeData.education && newResumeData.education.length > 0 ? (
                    <div className="space-y-3">
                      {newResumeData.education.map((edu, idx) => (
                        <div 
                          key={`new-edu-${idx}`} 
                          className={cn(
                            "bg-amber-50 dark:bg-slate-700/30 p-3 rounded-lg border border-amber-100 dark:border-slate-700 transition-all duration-300 hover:shadow-sm",
                            comparisonData.education.added.includes(edu) && "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <p className={cn(
                              "text-amber-900 dark:text-amber-300",
                              comparisonData.education.added.includes(edu) && "text-green-700 dark:text-green-400"
                            )}>
                              {edu}
                            </p>
                            {comparisonData.education.added.includes(edu) && (
                              <Badge variant="outline" className="text-xs bg-green-100/50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                                New
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 bg-amber-50/50 dark:bg-slate-700/20 rounded-lg border border-amber-100/50 dark:border-slate-700/50">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-amber-200 dark:text-slate-600" />
                      <p className="font-medium">No education information</p>
                      <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">No education data found in new resume.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Missing items from previous resume */}
          {(comparisonData.companies.removed.length > 0 || 
            comparisonData.titles.removed.length > 0 || 
            comparisonData.dates.removed.length > 0 ||
            comparisonData.education.removed.length > 0) && (
            <Card className="border-red-200 bg-red-50 dark:bg-slate-800 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Missing Information
                </CardTitle>
                <CardDescription>Items present in the previous resume but missing in the new one</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comparisonData.companies.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1 dark:text-red-300">Missing Companies/Clients:</h4>
                    <ul className="list-disc pl-5 text-sm dark:text-slate-200">
                      {comparisonData.companies.removed.map((name, idx) => (
                        <li key={`missing-company-${idx}`} className="mb-1 text-red-600 dark:text-red-400">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {comparisonData.titles.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1 dark:text-red-300">Missing Job Titles:</h4>
                    <ul className="list-disc pl-5 text-sm dark:text-slate-200">
                      {comparisonData.titles.removed.map((title, idx) => (
                        <li key={`missing-title-${idx}`} className="mb-1 text-red-600 dark:text-red-400">
                          {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {comparisonData.dates.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1 dark:text-red-300">Missing Employment Dates:</h4>
                    <ul className="list-disc pl-5 text-sm dark:text-slate-200">
                      {comparisonData.dates.removed.map((date, idx) => (
                        <li key={`missing-date-${idx}`} className="mb-1 text-red-600 dark:text-red-400">
                          {date}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {comparisonData.education.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1 dark:text-red-300">Missing Education:</h4>
                    <ul className="list-disc pl-5 text-sm dark:text-slate-200">
                      {comparisonData.education.removed.map((edu, idx) => (
                        <li key={`missing-edu-${idx}`} className="mb-1 text-red-600 dark:text-red-400">
                          {edu}
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