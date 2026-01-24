import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { storage } from "@/lib/storage";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const currentFile = storage.getCurrentFile();
  const bankInfo = currentFile?.bankInfo;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar bankInfo={bankInfo} />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card/50 backdrop-blur-sm px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            {bankInfo && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                <span className="text-sm font-medium text-secondary-foreground">
                  {bankInfo.bank_name}
                </span>
                <span className="text-xs text-muted-foreground">({bankInfo.currency})</span>
              </div>
            )}
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
