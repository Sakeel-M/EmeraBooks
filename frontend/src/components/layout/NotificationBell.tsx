import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRiskAlerts } from "@/hooks/useRiskAlerts";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NotificationBell() {
  const { totalOpen, bySeverity } = useRiskAlerts();
  const navigate = useNavigate();

  const tooltipLabel =
    totalOpen === 0
      ? "No active alerts"
      : `${totalOpen} alert${totalOpen > 1 ? "s" : ""}: ${bySeverity.critical ? `${bySeverity.critical} critical` : ""}${bySeverity.critical && bySeverity.high ? ", " : ""}${bySeverity.high ? `${bySeverity.high} high` : ""}`.replace(/:[\s,]*$/, "");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => navigate("/risk")}
        >
          <Bell className="h-5 w-5" />
          {totalOpen > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
            >
              {totalOpen > 99 ? "99+" : totalOpen}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}
