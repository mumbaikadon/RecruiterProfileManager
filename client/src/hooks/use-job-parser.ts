import { useMutation } from '@tanstack/react-query';
import { apiRequestWithJson } from '@/lib/queryClient';

export interface ParsedJobData {
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

interface UseJobParserOptions {
  onSuccess?: (data: ParsedJobData) => void;
  onError?: (error: Error) => void;
}

export function useJobParser(options?: UseJobParserOptions) {
  const mutation = useMutation({
    mutationFn: async (requirementText: string): Promise<ParsedJobData> => {
      return apiRequestWithJson('POST', '/api/jobs/parse-requirements', { requirementText });
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });

  return {
    parseRequirements: mutation.mutate,
    isParsing: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// Export alias for backward compatibility
export function useParseJobRequirements() {
  const { parseRequirements, isParsing, error, data } = useJobParser();
  
  return {
    mutate: parseRequirements,
    isPending: isParsing,
    error,
    data,
  };
}