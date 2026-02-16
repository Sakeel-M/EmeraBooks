import { Building2, CreditCard, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BankInfo } from "@/pages/Index";

interface BankInfoCardProps {
  bankInfo: BankInfo;
  accountHolder?: string;
}

const BankInfoCard = ({ bankInfo, accountHolder }: BankInfoCardProps) => {
  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Bank</p>
            <p className="font-semibold text-foreground">{bankInfo.bank_name}</p>
          </div>
        </div>
        {accountHolder && (
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Account Holder</p>
              <p className="font-semibold text-foreground">{accountHolder}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Currency</p>
            <p className="font-semibold text-foreground">{bankInfo.currency}</p>
          </div>
        </div>
        {bankInfo.country && (
          <div>
            <p className="text-xs text-muted-foreground">Country</p>
            <p className="font-semibold text-foreground">{bankInfo.country}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BankInfoCard;
