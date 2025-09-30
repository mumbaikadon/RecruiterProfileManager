import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserCheck, UserX, Crown, Shield, User, Briefcase, Ban, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrganizationUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: number;
}

export default function OrganizationPage() {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; user: OrganizationUser | null; selectedRole: string }>({
    open: false,
    user: null,
    selectedRole: "recruiter"
  });
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; user: OrganizationUser | null }>({
    open: false,
    user: null
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: OrganizationUser | null }>({
    open: false,
    user: null
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users based on selected tab
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["/api/organization/users", selectedTab === "pending" ? "pending" : "all"],
    queryFn: () => {
      const url = `/api/organization/users${selectedTab === "pending" ? "?status=pending" : ""}`;
      return fetch(url, { 
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      }).then(response => {
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        return response.json();
      });
    },
    retry: false,
  });

  // Approve user mutation with role assignment
  const approveMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      // First approve the user
      const approveResponse = await fetch(`/api/organization/users/${userId}/approve`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!approveResponse.ok) {
        throw new Error(`${approveResponse.status}: ${approveResponse.statusText}`);
      }
      const approveData = await approveResponse.json();
      
      // Then update their role
      const roleResponse = await fetch(`/api/organization/users/${userId}/role`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      if (!roleResponse.ok) {
        throw new Error(`${roleResponse.status}: ${roleResponse.statusText}`);
      }
      
      return { ...approveData, role };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      setApprovalDialog({ open: false, user: null, selectedRole: "recruiter" });
      toast({
        title: "User Approved",
        description: `${data.name} has been approved and assigned the ${data.role} role.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve user",
        variant: "destructive",
      });
    },
  });

  // Reject user mutation
  const rejectMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/organization/users/${userId}/reject`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      toast({
        title: "User Rejected",
        description: `${data.name} has been rejected.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : "Failed to reject user",
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await fetch(`/api/organization/users/${userId}/role`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      toast({
        title: "Role Updated",
        description: `${data.name}'s role has been updated to ${data.role}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Role Update Failed",
        description: error instanceof Error ? error.message : "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Deactivate user mutation
  const deactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/organization/users/${userId}/deactivate`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      toast({
        title: "User Deactivated",
        description: `${data.name} has been deactivated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Deactivation Failed",
        description: error instanceof Error ? error.message : "Failed to deactivate user",
        variant: "destructive",
      });
    },
  });

  // Reactivate user mutation
  const reactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/organization/users/${userId}/reactivate`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      toast({
        title: "User Reactivated",
        description: `${data.name} has been reactivated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Reactivation Failed",
        description: error instanceof Error ? error.message : "Failed to reactivate user",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/organization/users/${userId}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      toast({
        title: "User Deleted",
        description: `${data.name} has been permanently deleted.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="w-4 h-4" />;
      case "sub-admin":
        return <Shield className="w-4 h-4" />;
      case "manager":
        return <Briefcase className="w-4 h-4" />;
      case "lead":
        return <Users className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Approved</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "deactivated":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Deactivated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredUsers = Array.isArray(users) 
    ? (selectedTab === "pending" 
        ? users.filter((user: OrganizationUser) => user.status === "pending")
        : users.filter((user: OrganizationUser) => user.status === "approved"))
    : [];

  const deactivatedUsers = Array.isArray(users) 
    ? users.filter((user: OrganizationUser) => user.status === "deactivated")
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Management</h1>
          <p className="text-muted-foreground">
            Manage user approvals and role assignments for your organization
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Pending Approvals
            {Array.isArray(users) && users.filter((user: OrganizationUser) => user.status === "pending").length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {users.filter((user: OrganizationUser) => user.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            All Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Pending User Approvals
              </CardTitle>
              <CardDescription>
                Review and approve new user registrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading pending users...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">
                  Error loading users: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending user approvals
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user: OrganizationUser) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              @{user.username} • {user.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {user.role}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Registered {formatDistanceToNow(new Date(user.createdAt))} ago
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog 
                          open={approvalDialog.open && approvalDialog.user?.id === user.id} 
                          onOpenChange={(open) => {
                            if (!open) {
                              setApprovalDialog({ open: false, user: null, selectedRole: "recruiter" });
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() => setApprovalDialog({ open: true, user, selectedRole: "recruiter" })}
                              disabled={approveMutation.isPending}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Approve User & Assign Role</DialogTitle>
                              <DialogDescription>
                                Approve {user.name} and assign them a role in your organization.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Select Role</label>
                                <Select 
                                  value={approvalDialog.selectedRole} 
                                  onValueChange={(value) => setApprovalDialog(prev => ({ ...prev, selectedRole: value }))}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="recruiter">Recruiter</SelectItem>
                                    <SelectItem value="lead">Lead</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="sub-admin">Sub-admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setApprovalDialog({ open: false, user: null, selectedRole: "recruiter" })}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => approveMutation.mutate({ userId: user.id, role: approvalDialog.selectedRole })}
                                disabled={approveMutation.isPending}
                              >
                                {approveMutation.isPending ? "Approving..." : "Approve & Assign Role"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(user.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                All Organization Users
              </CardTitle>
              <CardDescription>
                Manage roles and view all users in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading users...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">
                  Error loading users: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              ) : !Array.isArray(users) || users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user: OrganizationUser) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              @{user.username} • {user.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(user.status)}
                              <span className="text-xs text-muted-foreground">
                                Joined {formatDistanceToNow(new Date(user.createdAt))} ago
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(role) => 
                            updateRoleMutation.mutate({ userId: user.id, role })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recruiter">Recruiter</SelectItem>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="sub-admin">Sub-Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeactivateDialog({ open: true, user })}
                          disabled={deactivateMutation.isPending}
                          data-testid={`button-deactivate-${user.id}`}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Deactivate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteDialog({ open: true, user })}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deactivated Users Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Deactivated Users
              </CardTitle>
              <CardDescription>
                Users who have been temporarily deactivated and can be reactivated
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading users...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">
                  Error loading users: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              ) : deactivatedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No deactivated users
                </div>
              ) : (
                <div className="space-y-4">
                  {deactivatedUsers.map((user: OrganizationUser) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              @{user.username} • {user.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(user.status)}
                              <span className="text-xs text-muted-foreground">
                                Joined {formatDistanceToNow(new Date(user.createdAt))} ago
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => reactivateMutation.mutate(user.id)}
                          disabled={reactivateMutation.isPending}
                          data-testid={`button-reactivate-${user.id}`}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Reactivate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteDialog({ open: true, user })}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deactivateDialog.open} onOpenChange={(open) => !open && setDeactivateDialog({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Deactivate User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {deactivateDialog.user?.name}? They will lose access to the system but their data will be preserved. You can reactivate them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (deactivateDialog.user) {
                  deactivateMutation.mutate(deactivateDialog.user.id);
                  setDeactivateDialog({ open: false, user: null });
                }
              }}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? "Deactivating..." : "Deactivate User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete User Permanently
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {deleteDialog.user?.name}? This action cannot be undone and will remove all user data from the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialog.user) {
                  deleteMutation.mutate(deleteDialog.user.id);
                  setDeleteDialog({ open: false, user: null });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}