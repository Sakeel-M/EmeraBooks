import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useImpersonation } from "@/hooks/useImpersonation";
import { ArrowLeft, UserCog, Shield, ShieldOff, Building2, FolderOpen, FileSpreadsheet, ArrowUpDown, Loader2 } from "lucide-react";

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const { startImpersonation } = useImpersonation();

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => flaskApi.get<any>(`/admin/users/${userId}`),
    enabled: !!userId,
  });

  const handleToggleAdmin = async () => {
    if (!userId) return;
    try {
      await flaskApi.patch(`/admin/users/${userId}/role`, {
        action: user?.is_admin ? "revoke" : "grant",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(user?.is_admin ? "Admin role revoked" : "Admin role granted");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const handleImpersonate = async () => {
    if (!userId) return;
    try {
      const result = await flaskApi.post<any>(`/admin/impersonate/${userId}`);
      startImpersonation(userId, result.email || "User");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/users">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">User Details</h1>
            <p className="text-muted-foreground">{user?.email || userId}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <p className="text-muted-foreground">User not found</p>
        ) : (
          <>
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleImpersonate}>
                <UserCog className="h-4 w-4" />
                Login as This User
              </Button>
              <Button
                size="sm"
                variant={user.is_admin ? "destructive" : "outline"}
                className="gap-1.5"
                onClick={handleToggleAdmin}
              >
                {user.is_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                {user.is_admin ? "Revoke Admin" : "Grant Admin"}
              </Button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{user.email || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Org Role</span>
                    <Badge variant="outline">{user.role}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admin</span>
                    <Badge className={user.is_admin ? "bg-amber-500" : "bg-gray-400"}>
                      {user.is_admin ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Organization
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{user.org?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Country</span>
                    <span>{user.org?.country || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span>{user.org?.default_currency || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locked Features</span>
                    <span>{(user.org?.locked_features || []).length || "None"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <FolderOpen className="h-5 w-5 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold">{user.stats?.client_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <FileSpreadsheet className="h-5 w-5 mx-auto text-green-600 mb-2" />
                  <p className="text-2xl font-bold">{user.stats?.file_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Files</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <ArrowUpDown className="h-5 w-5 mx-auto text-orange-500 mb-2" />
                  <p className="text-2xl font-bold">{(user.stats?.transaction_count ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                </CardContent>
              </Card>
            </div>

            {/* Clients */}
            {user.clients?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Clients ({user.clients.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {user.clients.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.industry || "—"} · {c.currency}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
