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
    recruiter: any 
  }>({
    queryKey: [`/api/submissions/${id}`],
    enabled: !!id,
  });
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: async (data: InsertSubmission) => {
      const res = await apiRequest("POST", "/api/submissions", data);
      
      // Check if the response was successful (no 4xx/5xx)
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create submission");
      }
      
      return await res.json();
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
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/submissions/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/submissions/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
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
