import { Users, UserPlus, Shield, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

interface AdminDashboardTabProps {
  users: AdminUser[];
  onNavigateToUsers: () => void;
}

export function AdminDashboardTab({ users, onNavigateToUsers }: AdminDashboardTabProps) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const adminCount = users.filter((u) => u.roles.includes("admin")).length;
  const newThisWeek = users.filter((u) => new Date(u.created_at) > weekAgo).length;
  const totalActivity = users.reduce(
    (s, u) => s + u.stats.files + u.stats.invoices + u.stats.bills + u.stats.transactions,
    0
  );

  const recentSignups = [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const stats = [
    { title: "Total Users", value: users.length, icon: Users, gradient: "from-blue-500 to-cyan-400", border: "border-l-blue-500" },
    { title: "New This Week", value: newThisWeek, icon: UserPlus, gradient: "from-emerald-500 to-green-400", border: "border-l-emerald-500" },
    { title: "Admins", value: adminCount, icon: Shield, gradient: "from-purple-500 to-indigo-400", border: "border-l-purple-500" },
    { title: "Total Activity", value: totalActivity, icon: Activity, gradient: "from-amber-500 to-orange-400", border: "border-l-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-600/20 via-indigo-600/10 to-blue-600/20 border border-purple-500/20 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              System overview and recent activity
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={`border-l-4 ${stat.border} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Signups + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSignups.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-purple-500/10 text-purple-600 font-medium">
                    {(user.full_name || user.email || "?").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(user.created_at), "MMM d, yyyy")}</p>
                </div>
                {user.roles.includes("admin") && (
                  <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs">Admin</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-amber-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={onNavigateToUsers}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Manage Users</p>
                <p className="text-xs text-muted-foreground">View, edit roles, or remove users</p>
              </div>
            </button>
            <button
              onClick={onNavigateToUsers}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <Shield className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Role Management</p>
                <p className="text-xs text-muted-foreground">Assign or revoke admin privileges</p>
              </div>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
