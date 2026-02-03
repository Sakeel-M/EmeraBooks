import { 
  Home,
  FileText,
  Receipt, 
  Users, 
  Building2,
  BarChart3, 
  Calculator,
  FolderOpen,
  Settings,
  Target,
  LogOut,
  Plug,
  ChevronUp,
  History,
  GitCompareArrows
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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

const menuItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Bills", url: "/bills", icon: FileText },
  { title: "Invoices", url: "/invoices", icon: Receipt },
  { title: "Vendors", url: "/vendors", icon: Building2 },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Financials", url: "/financials", icon: BarChart3 },
  { title: "Accounting", url: "/accounting", icon: Calculator },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Budget", url: "/budget", icon: Target },
  { title: "Reconciliation", url: "/reconciliation", icon: GitCompareArrows },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Sync History", url: "/sync-history", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  bankInfo?: {
    bank_name: string;
    currency: string;
    country: string;
  };
}

export function AppSidebar({ bankInfo }: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const getUserName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
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
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-green flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-sidebar-foreground truncate">Finance Analytics</h2>
                <p className="text-xs text-sidebar-foreground/70 truncate">AI-Powered</p>
              </div>
            )}
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">Navigation</SidebarGroupLabel>
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
                        <span className="flex-1">{item.title}</span>
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
        {bankInfo && !isCollapsed && (
          <div className="px-4 py-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-sidebar-primary animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sidebar-foreground truncate">{bankInfo.bank_name}</p>
                <p className="text-xs text-sidebar-foreground/70">
                  {bankInfo.currency} • {bankInfo.country}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className={`px-4 py-3 border-t border-sidebar-border cursor-pointer hover:bg-sidebar-accent/50 transition-colors ${!isCollapsed ? '' : 'flex justify-center'}`}>
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
