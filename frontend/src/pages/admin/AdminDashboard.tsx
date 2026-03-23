import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { flaskApi } from "@/lib/flaskApi";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users, Building2, FolderOpen, FileSpreadsheet, ArrowUpDown,
  Receipt, CreditCard, UserPlus, Loader2, ChevronRight, TrendingUp,
  Shield, Globe,
} from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => flaskApi.get<any>("/admin/stats"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users-preview"],
    queryFn: () => flaskApi.get<any>("/admin/users?per_page=5"),
  });

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs-preview"],
    queryFn: () => flaskApi.get<any>("/admin/orgs?per_page=5"),
  });

  const recentUsers = usersData?.users ?? [];
  const recentOrgs = orgsData?.orgs ?? [];

  const cards = [
    { label: "Total Users", value: stats?.total_users, icon: Users, color: "text-blue-600", bg: "bg-blue-50", link: "/admin/users" },
    { label: "Organizations", value: stats?.total_orgs, icon: Building2, color: "text-purple-600", bg: "bg-purple-50", link: "/admin/orgs" },
    { label: "Clients", value: stats?.total_clients, icon: FolderOpen, color: "text-green-600", bg: "bg-green-50", link: "/admin/orgs" },
    { label: "Transactions", value: stats?.total_transactions?.toLocaleString(), icon: ArrowUpDown, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Files Uploaded", value: stats?.total_files, icon: FileSpreadsheet, color: "text-cyan-600", bg: "bg-cyan-50" },
    { label: "Bills", value: stats?.total_bills, icon: Receipt, color: "text-red-500", bg: "bg-red-50" },
    { label: "Invoices", value: stats?.total_invoices, icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "New This Month", value: stats?.new_users_this_month, icon: UserPlus, color: "text-amber-600", bg: "bg-amber-50", link: "/admin/users" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Platform-wide overview and statistics</p>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Globe className="h-3 w-3" />
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </Badge>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Card
                key={card.label}
                className={`transition-all ${card.link ? "cursor-pointer hover:shadow-md hover:border-primary/30" : ""}`}
                onClick={() => card.link && navigate(card.link)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </CardTitle>
                  <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {card.value ?? "—"}
                  </p>
                  {card.link && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5">
                      View details <ChevronRight className="h-3 w-3" />
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Two-column: Recent Users + Recent Orgs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Recent Users</CardTitle>
                  <CardDescription className="text-xs">Latest registered users</CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-muted"
                  onClick={() => navigate("/admin/users")}
                >
                  View All <ChevronRight className="h-3 w-3 ml-0.5" />
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
              ) : (
                <div className="space-y-3">
                  {recentUsers.map((u: any) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/users/${u.user_id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.email || "No email"}</p>
                          <p className="text-[10px] text-muted-foreground">{u.org_name} · {u.client_count} clients</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {u.is_admin && <Badge className="text-[9px] bg-amber-500">Admin</Badge>}
                        <Badge variant="outline" className="text-[9px]">{u.role}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Organizations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Organizations</CardTitle>
                  <CardDescription className="text-xs">All registered organizations</CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-muted"
                  onClick={() => navigate("/admin/orgs")}
                >
                  View All <ChevronRight className="h-3 w-3 ml-0.5" />
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recentOrgs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No organizations yet</p>
              ) : (
                <div className="space-y-3">
                  {recentOrgs.map((org: any) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/admin/orgs")}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{org.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {org.member_count} members · {org.client_count} clients · {org.default_currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(org.locked_features || []).length > 0 ? (
                          <Badge variant="destructive" className="text-[9px]">
                            {org.locked_features.length} locked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-green-600">
                            All features
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Platform Summary */}
        {stats && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Platform Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">{stats.total_vendors ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Vendors</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{stats.total_customers ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Customers</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{stats.total_bills ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Bills</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{stats.total_invoices ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Invoices</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{stats.total_files ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Statements</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
