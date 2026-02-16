import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { AccountDialog } from "./AccountDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Calculator, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const typeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-red-100 text-red-700",
  equity: "bg-purple-100 text-purple-700",
  revenue: "bg-green-100 text-green-700",
  expense: "bg-yellow-100 text-yellow-700",
};

export function ChartOfAccountsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("*").eq("is_active", true).order("account_type").order("account_number");
      return data || [];
    },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", deleteId);
    if (error) toast.error("Failed to deactivate account");
    else { toast.success("Account deactivated"); queryClient.invalidateQueries({ queryKey: ["accounts"] }); }
    setDeleteId(null);
  };

  const grouped = accounts.reduce((acc: Record<string, any[]>, a: any) => {
    const type = a.account_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingAccount(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Account
        </Button>
      </div>

      {accounts.length === 0 && !isLoading ? (
        <Card><CardContent className="pt-6">
          <EmptyState icon={Calculator} title="No accounts" description="Set up your chart of accounts to start tracking." actionLabel="Add Account" onAction={() => setDialogOpen(true)} />
        </CardContent></Card>
      ) : (
        Object.entries(grouped).map(([type, accts]) => (
          <Card key={type}>
            <CardContent className="pt-6">
              <h3 className="font-semibold capitalize mb-4 flex items-center gap-2">
                <Badge className={typeColors[type] || ""}>{type}</Badge>
                <span className="text-muted-foreground text-sm">({(accts as any[]).length})</span>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(accts as any[]).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.account_number}</TableCell>
                      <TableCell className="font-medium">{a.account_name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.description || "—"}</TableCell>
                      <TableCell className="text-right">${(a.balance || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingAccount(a); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} account={editingAccount} onSaved={() => queryClient.invalidateQueries({ queryKey: ["accounts"] })} />
      <ConfirmDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} title="Deactivate Account" description="This account will be marked inactive. It won't appear in lists but historical data is preserved." confirmLabel="Deactivate" onConfirm={handleDelete} />
    </div>
  );
}
