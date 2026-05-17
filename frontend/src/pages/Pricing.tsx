import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Loader2, LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: "starter" | "pro";
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 199,
    tagline: "Manage your own accounting with AI",
    features: [
      "Full bookkeeping software access",
      "Bank statement upload & parsing",
      "Reconciliation, AR & AP modules",
      "Financial reports (P&L, Balance Sheet, Trial Balance, Cash Flow)",
      "AI-powered insights & risk scoring",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    tagline: "Fully managed — we handle everything",
    highlighted: true,
    features: [
      "Everything in Starter",
      "Monthly bookkeeping done for you",
      "Tax return preparation & filing (VAT + Corporate Tax)",
      "Annual corporate tax filing support",
      "Priority email & WhatsApp support",
      "Quarterly financial review with an accountant",
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => database.getSubscription(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (searchParams.get("canceled")) {
      toast.info("Checkout canceled. You can pick a plan whenever you're ready.");
    }
  }, [searchParams]);

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const currentPlan = isActive ? subscription?.plan_tier : null;

  const handleSubscribe = async (plan: "starter" | "pro") => {
    setLoadingPlan(plan);
    try {
      if (currentPlan && currentPlan !== plan) {
        const { url } = await database.openBillingPortal();
        window.location.assign(url);
        return;
      }
      const { url } = await database.createCheckoutSession(plan);
      window.location.assign(url);
    } catch (err: any) {
      toast.error(err?.message || "Could not start checkout. Please try again.");
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    setLoadingPlan("portal");
    try {
      const { url } = await database.openBillingPortal();
      window.location.assign(url);
    } catch (err: any) {
      toast.error(err?.message || "Could not open billing portal.");
      setLoadingPlan(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-white p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-end mb-4">
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5 text-neutral-600 hover:text-neutral-900">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-neutral-900 tracking-tight">
            Choose your plan
          </h1>
          <p className="text-neutral-500 max-w-xl mx-auto">
            One subscription per organization. All members get full access. Upgrade, downgrade, or cancel anytime from Settings → Billing.
          </p>
          {isActive && (
            <p className="mt-4 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                You're on the {String(currentPlan).toUpperCase()} plan
              </span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isLoadingThis = loadingPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl bg-white p-8 md:p-10 ${
                  plan.highlighted
                    ? "border-2 border-neutral-900 shadow-xl"
                    : "border border-neutral-200"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 right-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white shadow">
                      <Sparkles className="h-3 w-3" /> Most popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-neutral-900">{plan.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{plan.tagline}</p>
                </div>

                <div className="mb-8 flex items-baseline gap-2">
                  <span className="text-5xl md:text-6xl font-bold text-neutral-900 tracking-tight">
                    AED {plan.price}
                  </span>
                  <span className="text-neutral-500 text-base">/month</span>
                </div>

                <ul className="space-y-4 mb-10">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[15px] text-neutral-800 leading-relaxed">
                      <Check className="h-5 w-5 mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  {isCurrent ? (
                    <>
                      <Button
                        disabled
                        className="w-full h-12 rounded-full text-sm font-medium"
                        variant="outline"
                      >
                        <Check className="mr-1.5 h-4 w-4" /> Current plan
                      </Button>
                      <Button
                        onClick={handleManage}
                        variant="ghost"
                        className="w-full"
                        disabled={loadingPlan !== null}
                      >
                        {loadingPlan === "portal" ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : null}
                        Manage billing
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingPlan !== null || isLoading}
                      className={`w-full h-12 rounded-full text-sm font-medium ${
                        plan.highlighted
                          ? "bg-neutral-900 text-white hover:bg-neutral-800"
                          : "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : currentPlan ? (
                        <>Switch to {plan.name}</>
                      ) : (
                        <>Subscribe, AED {plan.price}/mo</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-neutral-500 mt-10">
          Payments are securely processed by Stripe. Prices in AED, billed monthly.
        </p>
      </div>
    </div>
  );
}
