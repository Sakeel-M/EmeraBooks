import { useQuery } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, FolderOpen, FileSpreadsheet, ArrowUpDown, Receipt, CreditCard, UserPlus, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => flaskApi.get<any>("/admin/stats"),
  });

  const cards = [
    { label: "Total Users", value: stats?.total_users, icon: Users, color: "text-blue-600" },
    { label: "Organizations", value: stats?.total_orgs, icon: Building2, color: "text-purple-600" },
    { label: "Clients", value: stats?.total_clients, icon: FolderOpen, color: "text-green-600" },
    { label: "Transactions", value: stats?.total_transactions?.toLocaleString(), icon: ArrowUpDown, color: "text-orange-500" },
    { label: "Files Uploaded", value: stats?.total_files, icon: FileSpreadsheet, color: "text-cyan-600" },
    { label: "Bills", value: stats?.total_bills, icon: Receipt, color: "text-red-500" },
    { label: "Invoices", value: stats?.total_invoices, icon: CreditCard, color: "text-emerald-600" },
    { label: "New This Month", value: stats?.new_users_this_month, icon: UserPlus, color: "text-amber-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide overview and statistics</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </CardTitle>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {card.value ?? "—"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
