import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useOrganizationUsers(status?: string) {
  return useQuery({
    queryKey: ["/api/organization/users", status || "all"],
    queryFn: () => apiRequest(`/api/organization/users${status ? `?status=${status}` : ""}`),
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => 
      apiRequest(`/api/organization/users/${userId}/approve`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
    },
  });
}

export function useRejectUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => 
      apiRequest(`/api/organization/users/${userId}/reject`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) => 
      apiRequest(`/api/organization/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
    },
  });
}