import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(0);

  const { data: subscription } = useQuery({
    queryKey: ["my-subscription-poll"],
    queryFn: () => database.getSubscription(),
    refetchInterval: (query) => {
      const sub = query.state.data;
      const active = sub?.status === "active" || sub?.status === "trialing";
      return active ? false : 1500;
    },
  });

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => navigate("/", { replace: true }), 800);
      return () => clearTimeout(t);
    }
  }, [isActive, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-6">
      <div className="text-center max-w-md">
        {isActive ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment successful</h1>
            <p className="text-muted-foreground">
              You're on the <span className="font-medium uppercase">{subscription?.plan_tier}</span> plan.
              Redirecting to your dashboard...
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Activating your subscription</h1>
            <p className="text-muted-foreground">
              We're confirming your payment with Stripe. This usually takes a few seconds.
            </p>
            {elapsed > 15 && (
              <p className="text-xs text-muted-foreground mt-4">
                Taking longer than expected?{" "}
                <button
                  onClick={() => navigate("/pricing", { replace: true })}
                  className="underline"
                >
                  Back to pricing
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
