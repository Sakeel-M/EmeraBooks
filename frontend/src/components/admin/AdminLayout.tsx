import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Building2, ArrowLeft, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ImpersonationBanner } from "./ImpersonationBanner";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Organizations", url: "/admin/orgs", icon: Building2 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <>
      <ImpersonationBanner />
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-[#1a3a2a] text-white flex flex-col shrink-0">
          {/* Logo */}
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-400" />
              <div>
                <h1 className="text-lg font-bold tracking-tight">EMARA BOOKS</h1>
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                  Admin Panel
                </span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.url ||
                (item.url !== "/admin" && location.pathname.startsWith(item.url));
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-white/10 space-y-2">
            <a
              href="https://app.emarabooks.com"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-white/60 hover:text-white hover:bg-white/10"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-background overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}
