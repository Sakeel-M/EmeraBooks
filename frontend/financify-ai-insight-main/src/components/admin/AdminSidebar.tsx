import { Shield, Users, LayoutDashboard, Activity, Settings, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "activity", label: "Activity Log", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="w-64 min-h-screen bg-[hsl(260,30%,12%)] text-white flex flex-col border-r border-white/10">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-sm tracking-wide">Admin Panel</h2>
          <p className="text-[11px] text-white/50">System Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-purple-600/40 to-indigo-600/30 text-white shadow-sm shadow-purple-500/20 border border-purple-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className={`w-4.5 h-4.5 ${isActive ? "text-purple-300" : ""}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Back to App */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to App</span>
        </button>
      </div>
    </aside>
  );
}
