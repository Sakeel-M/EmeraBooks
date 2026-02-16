import { useState } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, ShieldAlert, Users, UserPlus, Activity, Search, Trash2, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Layout } from "@/components/layout/Layout";
import { format } from "date-fns";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  stats: {
    files: number;
    invoices: number;
    bills: number;
    transactions: number;
  };
}

export default function Admin() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("admin-users", {
        method: "GET",
      });

      if (res.error) throw res.error;
      return (res.data as { users: AdminUser[] }).users;
    },
    enabled: isAdmin,
  });

  const callAdminApi = async (method: "GET" | "POST" | "PUT" | "DELETE", body: any) => {
    const res = await supabase.functions.invoke("admin-users", {
      method,
      body,
    });
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

  const adminCount = users.filter((u) => u.roles.includes("admin")).length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newThisWeek = users.filter((u) => new Date(u.created_at) > weekAgo).length;

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have admin privileges to view this page.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const statCards = [
    { title: "Total Users", value: users.length, icon: Users, color: "bg-primary/15 text-primary" },
    { title: "New This Week", value: newThisWeek, icon: UserPlus, color: "bg-blue-500/15 text-blue-600" },
    { title: "Admins", value: adminCount, icon: Shield, color: "bg-amber-500/15 text-amber-600" },
    {
      title: "Total Activity",
      value: users.reduce((s, u) => s + u.stats.files + u.stats.invoices + u.stats.bills + u.stats.transactions, 0),
      icon: Activity,
      color: "bg-emerald-500/15 text-emerald-600",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/30 border border-primary/10 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/15">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage users, roles, and monitor system activity
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* User Management Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3">User Management</h2>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-sm text-muted-foreground mt-3">Loading users…</p>
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
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
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
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
                              <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
                                Admin
                              </Badge>
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
        </div>

        <ConfirmDialog
          open={!!deleteUser}
          onOpenChange={(open) => !open && setDeleteUser(null)}
          title="Delete User"
          description={`Are you sure you want to delete ${deleteUser?.email}? This action cannot be undone and will remove all their data.`}
          onConfirm={handleDeleteUser}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
