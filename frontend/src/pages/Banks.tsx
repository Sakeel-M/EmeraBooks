import { Layout } from "@/components/layout/Layout";
import { CreditCard } from "lucide-react";

const Banks = () => {
  return (
    <Layout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Coming Soon</h1>
        <p className="text-muted-foreground max-w-sm">
          Banks &amp; Cards management is under construction. Check back soon for a full overview of your accounts and cards.
        </p>
      </div>
    </Layout>
  );
};

export default Banks;
