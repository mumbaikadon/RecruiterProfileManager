import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export interface JobApplication {
  id: number;
  jobId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  workAuthorization?: string;
  coverLetter?: string;
  resumeFileName?: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: number;
  notes?: string;
  job?: {
    id: number;
    title: string;
    clientName?: string;
    jobType?: string;
  };
}

interface GetApplicationsParams {
  jobId?: number;
  status?: string;
}

export function useJobApplications(params: GetApplicationsParams = {}) {
  return useQuery({
    queryKey: ['/api/applications', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.jobId) searchParams.append('jobId', params.jobId.toString());
      if (params.status) searchParams.append('status', params.status);
      
      const queryString = searchParams.toString();
      const url = `/api/applications${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch job applications');
      }
      
      return response.json() as Promise<JobApplication[]>;
    }
  });
}

export function useJobApplication(id: number) {
  return useQuery({
    queryKey: ['/api/applications', id],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job application');
      }
      
      return response.json() as Promise<JobApplication>;
    },
    enabled: !!id
  });
}

interface UpdateApplicationStatusParams {
  id: number;
  status: string;
  notes?: string;
}

export function useUpdateApplicationStatus() {
  return useMutation({
    mutationFn: async (params: UpdateApplicationStatusParams) => {
      const response = await fetch(`/api/applications/${params.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: params.status,
          notes: params.notes
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update application status');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the applications cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
    }
  });
}