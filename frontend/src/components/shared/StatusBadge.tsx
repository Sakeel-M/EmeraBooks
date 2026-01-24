import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusVariant = 
  | "draft" 
  | "sent" 
  | "paid" 
  | "overdue" 
  | "cancelled"
  | "pending"
  | "approved"
  | "rejected"
  | "reviewed"
  | "active"
  | "inactive"
  | "error";

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
}

const statusConfig: Record<StatusVariant, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  sent: {
    label: "Sent",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  paid: {
    label: "Paid",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  pending: {
    label: "Pending",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  reviewed: {
    label: "Reviewed",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  error: {
    label: "Error",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
