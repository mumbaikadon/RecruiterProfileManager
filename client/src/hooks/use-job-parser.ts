import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ParsedJobData {
  title?: string;
  client?: string;
  city?: string;
  state?: string;
  rate?: string;
  interviewType?: "phone" | "video" | "onsite" | "hybrid";
  visaRestrictions?: string;
  requiredSkills?: string[];
  description?: string;
  duration?: string;
  jobType?: "onsite" | "remote" | "hybrid";
}

export function useParseJobRequirements() {
  return useMutation({
    mutationFn: async (requirementText: string): Promise<ParsedJobData> => {
      const response = await apiRequest("/api/jobs/parse-requirements", {
        method: "POST",
        body: { requirementText },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to parse job requirements");
      }
      
      return response.json();
    },
  });
}