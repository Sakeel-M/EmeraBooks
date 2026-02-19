import { useState } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardTab } from "@/components/admin/AdminDashboardTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";

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

export default function Admin() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await supabase.functions.invoke("admin-users", { method: "GET" });
      if (res.error) throw res.error;
      return (res.data as { users: AdminUser[] }).users;
    },
    enabled: isAdmin,
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have admin privileges.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <AdminDashboardTab users={users} onNavigateToUsers={() => setActiveTab("users")} />;
      case "users":
        return <AdminUsersTab users={users} isLoading={isLoading} />;
      case "activity":
        return (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">Activity Log</p>
            <p className="text-sm mt-1">Coming soon — track user actions across the platform.</p>
          </div>
        );
      case "settings":
        return (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">Admin Settings</p>
            <p className="text-sm mt-1">Coming soon — configure system-wide settings.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTab()}
    </AdminLayout>
  );
}
