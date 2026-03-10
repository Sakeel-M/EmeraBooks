import {
  LayoutDashboard,
  GitCompareArrows,
  TrendingUp,
  TrendingDown,
  Landmark,
  BarChart3,
  Plug,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import emaraLogo from "@/assets/emara-logo-new.png";
import emaraBooksLogo from "@/assets/emara-books-logo.png";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRiskAlerts } from "@/hooks/useRiskAlerts";

const menuItems = [
  { title: "Control Center", url: "/", icon: LayoutDashboard },
  { title: "Reconciliation", url: "/reconciliation", icon: GitCompareArrows },
  { title: "Revenue Integrity", url: "/revenue", icon: TrendingUp },
  { title: "Expense Integrity", url: "/expenses", icon: TrendingDown },
  { title: "Cash & Liquidity", url: "/cash", icon: Landmark },
  { title: "Financial Reports", url: "/reports", icon: BarChart3 },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Risk Monitor", url: "/risk", icon: ShieldAlert, showBadge: true },
  { title: "Control Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();
  const { totalOpen, breakdown } = useRiskAlerts();
  const flagCount = (breakdown.flaggedRecon || 0) + (breakdown.overdueInvoices || 0) + (breakdown.overdueBills || 0);

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });

  const getUserName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split("@")[0];
    return "User";
  };

  const getUserInitials = () => {
    const name = getUserName();
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className="px-3 py-3 flex items-center justify-center">
            {!isCollapsed ? (
              <img
                src={emaraBooksLogo}
                alt="EMARA BOOKS"
                className="h-10 w-auto object-contain"
              />
            ) : (
              <img
                src={emaraLogo}
                alt="EMARA"
                className="h-8 w-8 object-contain"
              />
            )}
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          {item.showBadge && (totalOpen > 0 || flagCount > 0) && (
                            <div className="flex items-center gap-1">
                              {totalOpen > 0 && (
                                <Badge
                                  variant="destructive"
                                  className="h-5 min-w-[20px] px-1.5 text-xs"
                                >
                                  {totalOpen > 99 ? "99+" : totalOpen}
                                </Badge>
                              )}
                              {flagCount > 0 && (
                                <span className="text-[9px] text-muted-foreground">
                                  +{flagCount}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className={`px-4 py-3 border-t border-sidebar-border cursor-pointer hover:bg-sidebar-accent/50 transition-colors ${!isCollapsed ? "" : "flex justify-center"}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sidebar-foreground text-sm truncate">
                          {getUserName()}
                        </p>
                        <p className="text-xs text-sidebar-foreground/70 truncate">
                          {user.email}
                        </p>
                      </div>
                      <ChevronUp className="h-4 w-4 text-sidebar-foreground/70" />
                    </>
                  )}
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="w-56 bg-popover z-50"
            >
              <DropdownMenuItem
                onClick={() => navigate("/settings")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
