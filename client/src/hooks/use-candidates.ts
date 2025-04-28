import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Candidate, InsertCandidate } from "@shared/schema";

export function useCandidates() {
  return useQuery<Candidate[]>({
    queryKey: ["/api/candidates"]
  });
}

export function useCandidate(id: number) {
  return useQuery<Candidate & { 
    resumeData: any; 
    submissions: any[] 
  }>({
    queryKey: [`/api/candidates/${id}`],
    enabled: !!id,
  });
}

interface CreateCandidateData extends InsertCandidate {
  resumeData?: {
    clientNames: string[];
    jobTitles: string[];
    relevantDates: string[];
    skills: string[];
    education: string[];
    extractedText?: string;
  };
}

export function useCreateCandidate() {
  return useMutation({
    mutationFn: async (data: CreateCandidateData) => {
      const res = await apiRequest("POST", "/api/candidates", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
    }
  });
}

// Function to check if a candidate exists by DOB and SSN
export function useCheckCandidate() {
  return useMutation({
    mutationFn: async ({ 
      dobMonth, 
      dobDay, 
      ssn4 
    }: { 
      dobMonth: number; 
      dobDay: number; 
      ssn4: string 
    }) => {
      // This would need a dedicated endpoint in a production app
      // For this demo, we'll handle it with a more standard approach
      
      // Get all candidates and filter client-side
      const res = await fetch("/api/candidates");
      const candidates = await res.json() as Candidate[];
      
      const existingCandidate = candidates.find(
        c => c.dobMonth === dobMonth && c.dobDay === dobDay && c.ssn4 === ssn4
      );
      
      return {
        exists: !!existingCandidate,
        candidate: existingCandidate
      };
    }
  });
}
