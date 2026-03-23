import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Lock, Unlock, Settings, Loader2 } from "lucide-react";

const ALL_FEATURES = [
  { key: "reconciliation", label: "Reconciliation" },
  { key: "risk_monitor", label: "Risk Monitor" },
  { key: "integrations", label: "Integrations" },
  { key: "financial_reports", label: "Financial Reports" },
  { key: "revenue", label: "Revenue Integrity" },
  { key: "expenses", label: "Expense Integrity" },
  { key: "cash", label: "Cash & Liquidity" },
  { key: "settings", label: "Control Settings" },
];

export default function AdminOrgs() {
  const [search, setSearch] = useState("");
  const [editOrg, setEditOrg] = useState<any>(null);
  const [lockedFeatures, setLockedFeatures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orgs", search],
    queryFn: () => flaskApi.get<any>(`/admin/orgs?search=${encodeURIComponent(search)}`),
  });

  const orgs = data?.orgs ?? [];

  const openFeatureDialog = (org: any) => {
    setEditOrg(org);
    setLockedFeatures(org.locked_features || []);
  };

  const toggleFeature = (key: string) => {
    setLockedFeatures((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const saveFeatures = async () => {
    if (!editOrg) return;
    setSaving(true);
    try {
      await flaskApi.patch(`/admin/orgs/${editOrg.id}/features`, {
        locked_features: lockedFeatures,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      toast.success(`Features updated for ${editOrg.name}`);
      setEditOrg(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update features");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage organizations and feature access</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orgs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No organizations found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Locked Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((org: any) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>{org.country}</TableCell>
                      <TableCell>{org.default_currency}</TableCell>
                      <TableCell>{org.member_count}</TableCell>
                      <TableCell>{org.client_count}</TableCell>
                      <TableCell>
                        {(org.locked_features || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {org.locked_features.map((f: string) => (
                              <Badge key={f} variant="destructive" className="text-[9px]">
                                <Lock className="h-2.5 w-2.5 mr-0.5" />
                                {f}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Unlock className="h-3 w-3" /> All unlocked
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => openFeatureDialog(org)}
                        >
                          <Settings className="h-3 w-3" />
                          Manage Features
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Feature Lock Dialog */}
        <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Features — {editOrg?.name}</DialogTitle>
              <DialogDescription>
                Check a feature to <strong>lock</strong> it (disable for this organization). Unchecked = available.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {ALL_FEATURES.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={lockedFeatures.includes(f.key)}
                    onCheckedChange={() => toggleFeature(f.key)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{f.label}</p>
                  </div>
                  {lockedFeatures.includes(f.key) ? (
                    <Lock className="h-4 w-4 text-red-500" />
                  ) : (
                    <Unlock className="h-4 w-4 text-green-500" />
                  )}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOrg(null)}>Cancel</Button>
              <Button onClick={saveFeatures} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
