import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/hooks/useImpersonation";

export function ImpersonationBanner() {
  const { isImpersonating, targetEmail, stopImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Admin Mode: Viewing as <strong>{targetEmail}</strong>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs bg-white/80 hover:bg-white border-amber-700 text-amber-900"
        onClick={stopImpersonation}
      >
        <X className="h-3 w-3 mr-1" />
        Exit
      </Button>
    </div>
  );
}
