import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Receipt, Users, Building2, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  stats: { files: number; invoices: number; bills: number; transactions: number };
}

interface UserDetailSheetProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailSheet({ user, open, onOpenChange }: UserDetailSheetProps) {
  const { data: userData, isLoading } = useQuery({
    queryKey: ["admin-user-detail", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await supabase.functions.invoke("admin-users", {
        method: "POST",
        body: { action: "get_user_data", user_id: user.id },
      });
      if (res.error) throw res.error;
      return res.data as {
        invoices: any[];
        bills: any[];
        customers: any[];
        vendors: any[];
        transactions: any[];
      };
    },
    enabled: open && !!user,
  });

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-purple-500/30">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="bg-purple-500/10 text-purple-600 text-lg font-bold">
                {(user.full_name || user.email || "?").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-lg">{user.full_name || "No Name"}</SheetTitle>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex gap-2 mt-1">
                {user.roles.map((r) => (
                  <Badge key={r} className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs capitalize">
                    {r}
                  </Badge>
                ))}
                {user.roles.length === 0 && <Badge variant="secondary" className="text-xs">User</Badge>}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 my-4">
          {[
            { label: "Files", value: user.stats.files },
            { label: "Invoices", value: user.stats.invoices },
            { label: "Bills", value: user.stats.bills },
            { label: "Txns", value: user.stats.transactions },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* User Data Tabs */}
        <Tabs defaultValue="invoices" className="mt-4">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="invoices" className="text-xs"><Receipt className="h-3 w-3 mr-1" />Inv</TabsTrigger>
            <TabsTrigger value="bills" className="text-xs"><FileText className="h-3 w-3 mr-1" />Bills</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs"><CreditCard className="h-3 w-3 mr-1" />Txns</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs"><Users className="h-3 w-3 mr-1" />Cust</TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs"><Building2 className="h-3 w-3 mr-1" />Vend</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <TabsContent value="invoices">
                <SimpleTable
                  data={userData?.invoices || []}
                  columns={["invoice_number", "total_amount", "status", "invoice_date"]}
                  headers={["#", "Amount", "Status", "Date"]}
                  emptyMessage="No invoices"
                />
              </TabsContent>
              <TabsContent value="bills">
                <SimpleTable
                  data={userData?.bills || []}
                  columns={["bill_number", "total_amount", "status", "bill_date"]}
                  headers={["#", "Amount", "Status", "Date"]}
                  emptyMessage="No bills"
                />
              </TabsContent>
              <TabsContent value="transactions">
                <SimpleTable
                  data={userData?.transactions || []}
                  columns={["description", "amount", "category", "transaction_date"]}
                  headers={["Desc", "Amount", "Category", "Date"]}
                  emptyMessage="No transactions"
                />
              </TabsContent>
              <TabsContent value="customers">
                <SimpleTable
                  data={userData?.customers || []}
                  columns={["name", "email", "balance"]}
                  headers={["Name", "Email", "Balance"]}
                  emptyMessage="No customers"
                />
              </TabsContent>
              <TabsContent value="vendors">
                <SimpleTable
                  data={userData?.vendors || []}
                  columns={["name", "email", "balance"]}
                  headers={["Name", "Email", "Balance"]}
                  emptyMessage="No vendors"
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function SimpleTable({
  data,
  columns,
  headers,
  emptyMessage,
}: {
  data: any[];
  columns: string[];
  headers: string[];
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">{emptyMessage}</p>;
  }

  return (
    <div className="rounded-md border mt-2 max-h-64 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h} className="text-xs">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 20).map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col} className="text-xs py-2">
                  {col.includes("date")
                    ? row[col] ? format(new Date(row[col]), "MMM d, yy") : "—"
                    : col === "amount" || col === "total_amount" || col === "balance"
                    ? typeof row[col] === "number" ? row[col].toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"
                    : row[col] ?? "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
