import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard, TrendingUp, Wallet } from "lucide-react";
import { BankAccountDialog } from "@/components/banks/BankAccountDialog";
import { DataTable } from "@/components/shared/DataTable";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/export";
import { useCurrency } from "@/hooks/useCurrency";
import { ColumnDef } from "@tanstack/react-table";

export default function Banks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const { toast } = useToast();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({ title: "Success", description: "Bank account deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Group balances by currency to avoid incorrect cross-currency summation
  const balanceByCurrency: Record<string, number> = {};
  accounts.filter((acc) => acc.is_active).forEach((acc) => {
    const cur = acc.currency || currency;
    balanceByCurrency[cur] = (balanceByCurrency[cur] || 0) + Number(acc.balance || 0);
  });
  const currencyKeys = Object.keys(balanceByCurrency);
  // Use single-currency total if all accounts share one currency; else show first currency
  const totalBalance = currencyKeys.length === 1
    ? balanceByCurrency[currencyKeys[0]]
    : Object.values(balanceByCurrency).reduce((s, v) => s + v, 0);
  const totalBalanceCurrency = currencyKeys.length === 1 ? currencyKeys[0] : currency;
  const mixedCurrencies = currencyKeys.length > 1;

  const activeAccounts = accounts.filter((acc) => acc.is_active).length;

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "bank_name",
      header: "Bank Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.original.bank_name}</div>
            <div className="text-sm text-muted-foreground">{row.original.account_name}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "account_number",
      header: "Account Number",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.account_number || "—"}</span>
      ),
    },
    {
      accessorKey: "account_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.account_type || "General"}
        </Badge>
      ),
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(Number(row.original.balance || 0), row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
          onEdit={() => {
            setSelectedAccount(row.original);
            setDialogOpen(true);
          }}
          onDelete={() => deleteMutation.mutate(row.original.id)}
        />
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Banks & Cards</h1>
            <p className="text-muted-foreground">Manage your bank accounts and card connections</p>
          </div>
          <Button onClick={() => { setSelectedAccount(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalBalance, totalBalanceCurrency)}</div>
              <p className="text-xs text-muted-foreground">
                {mixedCurrencies ? "Multiple currencies — see individual accounts" : "Across all active accounts"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAccounts}</div>
              <p className="text-xs text-muted-foreground">Connected bank accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
              <p className="text-xs text-muted-foreground">Including inactive</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={accounts}
              searchKey="bank_name"
              searchPlaceholder="Search banks..."
              isLoading={isLoading}
              showPagination={accounts.length > 10}
            />
          </CardContent>
        </Card>

        <BankAccountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          account={selectedAccount}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
            setSelectedAccount(null);
          }}
        />
      </div>
    </Layout>
  );
}
