import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface UpdateJobDescriptionParams {
  id: number;
  description: string;
}

export function useUpdateJobDescription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, description }: UpdateJobDescriptionParams) => {
      const response = await apiRequest(`/api/jobs/${id}/description`, 'PUT', { 
        description 
      });
      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
  });
}