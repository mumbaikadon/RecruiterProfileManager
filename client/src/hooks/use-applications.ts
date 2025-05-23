import { useQuery } from "@tanstack/react-query";

export interface JobApplication {
  id: number;
  jobId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeFileName: string | null;
  coverLetter: string | null;
  workAuthorization: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  reviewedBy: number | null;
  job?: {
    id: number;
    title: string;
    clientName: string | null;
    jobType: string | null;
  } | null;
}

// Hook to fetch applications for a specific job
export function useJobApplications(jobId: number) {
  return useQuery<JobApplication[]>({
    queryKey: ['/api/applications', { jobId }],
    queryFn: async () => {
      const response = await fetch(`/api/applications?jobId=${jobId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch applications");
      }
      return response.json();
    },
    enabled: !!jobId,
  });
}

// Hook to fetch a single application by ID
export function useJobApplication(id: number) {
  return useQuery<JobApplication>({
    queryKey: ['/api/applications', id],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch application");
      }
      return response.json();
    },
    enabled: !!id,
  });
}