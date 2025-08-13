import { useMutation } from '@tanstack/react-query';
import { apiRequestWithJson } from '@/lib/queryClient';

interface JobParserResult {
  title?: string;
  client?: string;
  city?: string;
  state?: string;
  rate?: string;
  interviewType?: string;
  visaRestrictions?: string;
  requiredSkills?: string[];
  description?: string;
}

interface JobParserError {
  message: string;
}

interface UseJobParserOptions {
  onSuccess?: (data: JobParserResult) => void;
  onError?: (error: JobParserError) => void;
}

export function useJobParser() {
  const mutation = useMutation({
    mutationFn: async (requirementsText: string): Promise<JobParserResult> => {
      return apiRequestWithJson<JobParserResult>(
        'POST',
        '/api/parse-job-requirements',
        { requirementsText }
      );
    },
  });

  const parseRequirements = (requirementsText: string, options?: UseJobParserOptions) => {
    mutation.mutate(requirementsText, {
      onSuccess: (data) => {
        options?.onSuccess?.(data);
      },
      onError: (error) => {
        options?.onError?.({ message: error instanceof Error ? error.message : 'Unknown error' });
      },
    });
  };

  return {
    parseRequirements,
    isParsing: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}