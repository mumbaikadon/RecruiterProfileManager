import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job, InsertJob } from "@shared/schema";

export function useJobs(filters?: { status?: string; date?: string; search?: string }) {
  let url = "/api/jobs";
  const queryParams = new URLSearchParams();
  
  if (filters) {
    if (filters.status) queryParams.append("status", filters.status);
    if (filters.date) queryParams.append("date", filters.date);
    if (filters.search) queryParams.append("search", filters.search);
    
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }
  }
  
  return useQuery<Job[]>({
    queryKey: [url]
  });
}

export function useJob(id: number) {
  return useQuery<Job & { 
    assignedRecruiters: any[]; 
    submissions: any[]
  }>({
    queryKey: [`/api/jobs/${id}`],
    enabled: !!id,
  });
}

export function useCreateJob() {
  return useMutation({
    mutationFn: async (data: InsertJob & { recruiterIds: number[] }) => {
      const res = await apiRequest({
        method: "POST", 
        url: "/api/jobs", 
        data
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    }
  });
}

export function useUpdateJobStatus() {
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest({
        method: "PUT", 
        url: `/api/jobs/${id}/status`, 
        data: { status }
      });
      return res;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  });
}

export function useAssignRecruiters() {
  return useMutation({
    mutationFn: async ({ jobId, recruiterIds }: { jobId: number; recruiterIds: number[] }) => {
      const res = await fetch(`/api/jobs/${jobId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterIds }),
        credentials: "include"
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${variables.jobId}`] });
    }
  });
}
