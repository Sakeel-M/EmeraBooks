import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Check, Eye, Trash2 } from "lucide-react";
import { PayableForm } from "./PayableForm";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatCurrency, isOverdue, type PayableReceivable } from "@/lib/payables";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface PayablesTableProps {
  items: PayableReceivable[];
  type: "payable" | "receivable";
  isLoading?: boolean;
}

export function PayablesTable({ items, type, isLoading }: PayablesTableProps) {
  const [editItem, setEditItem] = useState<PayableReceivable | null>(null);
  const [deleteItem, setDeleteItem] = useState<PayableReceivable | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const settleMutation = useMutation({
    mutationFn: async (item: PayableReceivable) => {
      if (item.source === "bill" || item.source === "invoice") {
        // Update the source table
        const table = item.source === "bill" ? "bills" : "invoices";
        const { error } = await supabase
          .from(table)
          .update({ status: "paid", amount_paid: item.amount })
          .eq("id", item.source_id);
        if (error) throw error;
      } else {
        // Update payables_receivables table
        const { error } = await supabase
          .from("payables_receivables")
          .update({ status: "settled" })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Item marked as settled");
      queryClient.invalidateQueries({ queryKey: ["payables-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to settle item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: PayableReceivable) => {
      const { error } = await supabase
        .from("payables_receivables")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["payables-receivables"] });
      setDeleteItem(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete item");
    },
  });

  const getStatusBadge = (item: PayableReceivable) => {
    const overdue = item.due_date && isOverdue(item.due_date) && item.status !== "settled";
    
    if (overdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    
    switch (item.status) {
      case "settled":
        return <Badge variant="default" className="bg-primary">Settled</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getRowClassName = (item: PayableReceivable) => {
    const overdue = item.due_date && isOverdue(item.due_date) && item.status !== "settled";
    
    if (overdue) {
      return "bg-destructive/10 hover:bg-destructive/15";
    }
    
    if (item.status === "pending") {
      return "bg-amber-500/5 hover:bg-amber-500/10";
    }
    
    if (item.status === "settled") {
      return "bg-primary/5 hover:bg-primary/10";
    }
    
    return "";
  };

  const getSourceBadge = (item: PayableReceivable) => {
    switch (item.source) {
      case "bill":
        return <Badge variant="secondary">Bill</Badge>;
      case "invoice":
        return <Badge variant="secondary">Invoice</Badge>;
      case "bank_statement":
        return <Badge variant="outline">Bank Statement</Badge>;
      default:
        return <Badge variant="outline">Manual</Badge>;
    }
  };

  const handleViewSource = (item: PayableReceivable) => {
    if (item.source === "bill") {
      navigate("/bills");
    } else if (item.source === "invoice") {
      navigate("/invoices");
    }
  };

  const filteredItems = items.filter(i => i.type === type);

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7} className="h-16">
                  <div className="animate-pulse bg-muted h-4 rounded w-3/4"></div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">
          No {type === "payable" ? "payables" : "receivables"} found.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Add entries manually or upload bank statements to auto-extract.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id} className={getRowClassName(item)}>
                <TableCell className="font-medium">
                  <div>
                    <div>{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{item.category || "-"}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.amount, item.currency)}
                </TableCell>
                <TableCell>
                  {item.due_date ? format(new Date(item.due_date), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell>{getStatusBadge(item)}</TableCell>
                <TableCell>{getSourceBadge(item)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {item.source === "manual" && (
                        <DropdownMenuItem onClick={() => setEditItem(item)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {(item.source === "bill" || item.source === "invoice") && (
                        <DropdownMenuItem onClick={() => handleViewSource(item)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View {item.source === "bill" ? "Bill" : "Invoice"}
                        </DropdownMenuItem>
                      )}
                      {item.status !== "settled" && (
                        <DropdownMenuItem onClick={() => settleMutation.mutate(item)}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Settled
                        </DropdownMenuItem>
                      )}
                      {item.source === "manual" && (
                        <DropdownMenuItem 
                          onClick={() => setDeleteItem(item)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PayableForm
        editItem={editItem || undefined}
        open={!!editItem}
        onOpenChange={(isOpen) => !isOpen && setEditItem(null)}
        onSuccess={() => setEditItem(null)}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Entry"
        description={`Are you sure you want to delete "${deleteItem?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem)}
        variant="destructive"
      />
    </>
  );
}
