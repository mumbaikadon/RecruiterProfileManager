import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Submission, InsertSubmission } from "@shared/schema";

export function useSubmissions(filters?: { jobId?: number; candidateId?: number; recruiterId?: number }) {
  let url = "/api/submissions";
  const queryParams = new URLSearchParams();
  
  if (filters) {
    if (filters.jobId) queryParams.append("jobId", filters.jobId.toString());
    if (filters.candidateId) queryParams.append("candidateId", filters.candidateId.toString());
    if (filters.recruiterId) queryParams.append("recruiterId", filters.recruiterId.toString());
    
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }
  }
  
  return useQuery<Submission[]>({
    queryKey: [url]
  });
}

export function useSubmission(id: number) {
  return useQuery<Submission & { 
    job: any; 
    candidate: any; 
    recruiter: any;
    resumeData?: any;
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
    technicalGaps?: string[];
    matchingSkills?: string[];
    missingSkills?: string[];
    clientExperience?: string;
    confidence?: number;
  }>({
    queryKey: [`/api/submissions/${id}`],
    enabled: !!id,
  });
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: async (data: InsertSubmission) => {
      try {
        const res = await apiRequest("POST", "/api/submissions", data);
        
        // Check if the response was successful (no 4xx/5xx)
        if (!res.ok) {
          // Try to parse error message if available
          try {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to create submission");
          } catch (parseError) {
            // If JSON parsing fails, use status text
            throw new Error(`Submission failed: ${res.statusText || "Unknown error"}`);
          }
        }
        
        // Try to parse the response
        try {
          return await res.json();
        } catch (parseError) {
          console.error("Error parsing response:", parseError);
          throw new Error("Failed to parse server response. The submission might have been created but couldn't be confirmed.");
        }
      } catch (error) {
        console.error("Submission error:", error);
        throw error instanceof Error ? error : new Error("An unknown error occurred");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    }
  });
}

export function useUpdateSubmissionStatus() {
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      feedback 
    }: { 
      id: number; 
      status: string; 
      feedback?: string 
    }) => {
      const res = await apiRequest(
        "PUT", 
        `/api/submissions/${id}/status`, 
        { status, feedback }
      );
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/submissions/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  });
}

export function useDashboardStats() {
  return useQuery<{
    activeJobs: number;
    totalSubmissions: number;
    assignedActiveJobs: number;
    submissionsThisWeek: number;
  }>({
    queryKey: ["/api/dashboard/stats"]
  });
}

export function useActivities(limit: number = 20) {
  return useQuery<any[]>({
    queryKey: [`/api/activities?limit=${limit}`]
  });
}
