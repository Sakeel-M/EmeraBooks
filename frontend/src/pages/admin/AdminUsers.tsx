import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useImpersonation } from "@/hooks/useImpersonation";
import { Search, Shield, ShieldOff, Eye, UserCog, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { startImpersonation } = useImpersonation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () =>
      flaskApi.get<any>(`/admin/users?search=${encodeURIComponent(search)}&page=${page}&per_page=30`),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const handleToggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    try {
      await flaskApi.patch(`/admin/users/${userId}/role`, {
        action: currentlyAdmin ? "revoke" : "grant",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(currentlyAdmin ? "Admin role revoked" : "Admin role granted");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const result = await flaskApi.post<any>(`/admin/impersonate/${userId}`);
      startImpersonation(userId, result.email || "User");
    } catch (err: any) {
      toast.error(err.message || "Failed to impersonate");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-muted-foreground">{total} registered users</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or organization..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 max-w-md"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{u.email || "No email"}</span>
                          {u.is_admin && (
                            <Badge className="text-[9px] bg-amber-500">Admin</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.org_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{u.client_count}</TableCell>
                      <TableCell className="text-sm">{u.file_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.created_at ? formatDistanceToNow(new Date(u.created_at), { addSuffix: true }) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/admin/users/${u.user_id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleImpersonate(u.user_id)}
                          >
                            <UserCog className="h-3 w-3" />
                            Login As
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 text-xs gap-1 ${u.is_admin ? "text-red-500" : "text-amber-600"}`}
                            onClick={() => handleToggleAdmin(u.user_id, u.is_admin)}
                          >
                            {u.is_admin ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                            {u.is_admin ? "Revoke" : "Grant"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > 30 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / 30)}
            </span>
            <Button size="sm" variant="outline" disabled={page * 30 >= total} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
