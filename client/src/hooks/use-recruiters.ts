import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

export function useRecruiters() {
  return useQuery<User[]>({
    queryKey: ["/api/recruiters"],
  });
}
