import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CandidateValidationParams {
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
  validatedBy: number;
  // Add suspicious flags
  isSuspicious?: boolean;
  suspiciousReason?: string;
  suspiciousSeverity?: "LOW" | "MEDIUM" | "HIGH";
}

export function useCandidateValidation() {
  return useMutation({
    mutationFn: async (data: CandidateValidationParams) => {
      try {
        const res = await apiRequest("POST", "/api/candidates/validate", data);
        
        if (!res.ok) {
          // Try to parse error message if available
          try {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to validate candidate");
          } catch (parseError) {
            // If JSON parsing fails, use status text
            throw new Error(`Validation failed: ${res.statusText || "Unknown error"}`);
          }
        }
        
        return await res.json();
      } catch (error) {
        console.error("Candidate validation error:", error);
        throw error instanceof Error ? error : new Error("An unknown error occurred");
      }
    },
    onSuccess: (data) => {
      // Invalidate queries that would be affected by this validation
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${data.candidate?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
    }
  });
}