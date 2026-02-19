import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Trash2, UserCog, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  stats: { files: number; invoices: number; bills: number; transactions: number };
}

interface AdminUsersTabProps {
  users: AdminUser[];
  isLoading: boolean;
}

export function AdminUsersTab({ users, isLoading }: AdminUsersTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const callAdminApi = async (method: "POST" | "DELETE", body: any) => {
    const res = await supabase.functions.invoke("admin-users", { method, body });
    if (res.error) throw res.error;
    return res.data;
  };

  const handleToggleAdmin = async (user: AdminUser) => {
    const isTargetAdmin = user.roles.includes("admin");
    try {
      await callAdminApi("POST", {
        user_id: user.id,
        role: "admin",
        action: isTargetAdmin ? "remove" : "assign",
      });
      toast.success(isTargetAdmin ? "Admin role removed" : "Admin role assigned");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    try {
      await callAdminApi("DELETE", { user_id: deleteUser.id });
      toast.success("User deleted successfully");
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete user");
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" && u.roles.includes("admin")) ||
      (roleFilter === "user" && !u.roles.includes("admin"));
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">User Management</h2>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="user">Regular Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-center">Files</TableHead>
                  <TableHead className="text-center">Invoices</TableHead>
                  <TableHead className="text-center">Bills</TableHead>
                  <TableHead className="text-center">Txns</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-3">Loading users…</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <p className="text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-purple-500/10 text-purple-600 font-medium">
                              {(user.full_name || user.email || "?").substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{user.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.roles.includes("admin") ? (
                          <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_sign_in_at ? format(new Date(user.last_sign_in_at), "MMM d, yyyy") : "Never"}
                      </TableCell>
                      <TableCell className="text-center text-sm">{user.stats.files}</TableCell>
                      <TableCell className="text-center text-sm">{user.stats.invoices}</TableCell>
                      <TableCell className="text-center text-sm">{user.stats.bills}</TableCell>
                      <TableCell className="text-center text-sm">{user.stats.transactions}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/user/${user.id}`)} title="View user dashboard">
                             <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAdmin(user)}
                            title={user.roles.includes("admin") ? "Remove admin" : "Make admin"}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteUser(user)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        title="Delete User"
        description={`Are you sure you want to delete ${deleteUser?.email}? This action cannot be undone.`}
        onConfirm={handleDeleteUser}
        variant="destructive"
      />

    </div>
  );
}
