import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, fromUnixTime } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { database, type BillingInvoice } from "@/lib/database";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const PLAN_PRICE: Record<string, number> = { starter: 199, pro: 999 };
const PLAN_LABEL: Record<string, string> = {
  starter: "Starter — Software access only",
  pro: "Pro — Software + tax filing + bookkeeping",
};

function statusBadge(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) {
    return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">Cancels at period end</Badge>;
  }
  switch (status) {
    case "active":
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">Active</Badge>;
    case "trialing":
      return <Badge className="bg-blue-600 hover:bg-blue-700">Trialing</Badge>;
    case "past_due":
      return <Badge variant="destructive">Past due</Badge>;
    case "canceled":
      return <Badge variant="secondary">Canceled</Badge>;
    case "incomplete":
    case "unpaid":
      return <Badge variant="outline" className="border-amber-500 text-amber-700">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatMoney(amountInMinorUnits: number, currency: string) {
  return `${currency} ${(amountInMinorUnits / 100).toFixed(2)}`;
}

export function BillingTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: subscription, isLoading: subLoading, isFetching: subFetching } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => database.getSubscription(),
    staleTime: 30_000,
  });

  const { data: invoicesData, isLoading: invLoading, isFetching: invFetching } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: () => database.getBillingInvoices(),
    staleTime: 60_000,
    enabled: !!subscription?.stripe_customer_id,
  });

  const invoices: BillingInvoice[] = invoicesData?.invoices || [];
  const isAdmin = subscription?.my_role === "owner" || subscription?.my_role === "admin";
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const handleManagePayment = async () => {
    setBusy("portal");
    try {
      const { url } = await database.openBillingPortal();
      window.location.assign(url);
    } catch (err: any) {
      toast.error(err?.message || "Could not open billing portal.");
      setBusy(null);
    }
  };

  const handleChangePlan = () => navigate("/pricing");

  const handleCancel = async () => {
    setBusy("cancel");
    setCancelOpen(false);
    try {
      await database.cancelSubscription();
      toast.success("Subscription will cancel at the end of the current billing period.");
      queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel subscription.");
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = async () => {
    setBusy("reactivate");
    try {
      await database.reactivateSubscription();
      toast.success("Subscription reactivated. It will keep renewing.");
      queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to reactivate subscription.");
    } finally {
      setBusy(null);
    }
  };

  if (subLoading || subFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No subscription</CardTitle>
          <CardDescription>Your organization doesn't have a subscription yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleChangePlan}>
            <Sparkles className="mr-2 h-4 w-4" /> Choose a plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  const plan = subscription.plan_tier;
  const priceLabel = plan ? `AED ${PLAN_PRICE[plan]}/month` : "—";
  const planLabel = plan ? PLAN_LABEL[plan] : "Unknown";
  const renewLabel = subscription.current_period_end
    ? format(new Date(subscription.current_period_end), "PPP")
    : "—";

  return (
    <div className="space-y-4">
      {/* Plan summary */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current plan
            </CardTitle>
            <CardDescription>Subscription is shared by all members of your organization.</CardDescription>
          </div>
          {statusBadge(subscription.status, subscription.cancel_at_period_end)}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plan</p>
              <p className="text-lg font-medium mt-1">{planLabel}</p>
              <p className="text-sm text-muted-foreground">{priceLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {subscription.cancel_at_period_end ? "Access ends" : "Next renewal"}
              </p>
              <p className="text-lg font-medium mt-1">{renewLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Billing email</p>
              <p className="text-sm mt-1 break-all">{subscription.billing_email}</p>
            </div>
          </div>

          {subscription.cancel_at_period_end && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">Cancellation scheduled</p>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                  Your subscription is set to cancel at the end of the current billing period. You can reactivate before {renewLabel} to keep things running.
                </p>
              </div>
            </div>
          )}

          {subscription.status === "past_due" && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-900 dark:text-red-200">Payment failed</p>
                <p className="text-red-800 dark:text-red-300 mt-0.5">
                  Your last payment didn't go through. Update your payment method to keep using the app.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons — owner/admin only */}
          {isAdmin ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={handleChangePlan} disabled={busy !== null}>
                <Sparkles className="mr-2 h-3.5 w-3.5" /> Change plan
              </Button>
              <Button variant="outline" onClick={handleManagePayment} disabled={busy !== null}>
                {busy === "portal" ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                )}
                Manage payment method
              </Button>
              {subscription.cancel_at_period_end ? (
                <Button onClick={handleReactivate} disabled={busy !== null}>
                  {busy === "reactivate" ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Reactivate
                </Button>
              ) : (
                isActive && (
                  <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setCancelOpen(true)} disabled={busy !== null}>
                    <XCircle className="mr-2 h-3.5 w-3.5" /> Cancel subscription
                  </Button>
                )
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pt-2">Only the org owner or admin can change billing settings.</p>
          )}
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Billing history
          </CardTitle>
          <CardDescription>Past invoices for your organization. Click PDF to download.</CardDescription>
        </CardHeader>
        <CardContent>
          {invLoading || invFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No invoices yet.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const dt = format(fromUnixTime(inv.created), "PP");
                    const amt = formatMoney(inv.amount_paid || inv.amount_due, inv.currency);
                    const statusEl =
                      inv.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                        </span>
                      ) : inv.status === "open" ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <AlertCircle className="h-3.5 w-3.5" /> Open
                        </span>
                      ) : (
                        <span className="text-muted-foreground capitalize">{inv.status}</span>
                      );

                    return (
                      <TableRow key={inv.id}>
                        <TableCell>{dt}</TableCell>
                        <TableCell className="font-mono text-xs">{inv.number || inv.id.slice(0, 14)}</TableCell>
                        <TableCell className="tabular-nums">{amt}</TableCell>
                        <TableCell>{statusEl}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {inv.invoice_pdf && (
                              <Button asChild size="sm" variant="outline">
                                <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                  <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                                </a>
                              </Button>
                            )}
                            {inv.hosted_invoice_url && (
                              <Button asChild size="sm" variant="ghost">
                                <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until {renewLabel}. After that, your organization will lose access to the app until a new plan is selected. You can reactivate anytime before that date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
