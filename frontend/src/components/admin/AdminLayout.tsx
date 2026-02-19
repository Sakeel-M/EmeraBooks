import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar activeTab={activeTab} onTabChange={onTabChange} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
