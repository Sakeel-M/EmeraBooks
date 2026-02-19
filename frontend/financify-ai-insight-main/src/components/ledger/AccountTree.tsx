import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AccountTreeProps {
  accounts: Array<{
    id: string;
    account_name: string;
    account_number: string;
    account_type: string;
    balance: number | null;
  }>;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null, accountName: string | null) => void;
}

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-green-500",
  liability: "bg-red-500",
  equity: "bg-blue-500",
  revenue: "bg-purple-500",
  expense: "bg-orange-500",
};

const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Operating Expenses",
};

export function AccountTree({ accounts, selectedAccountId, onSelectAccount }: AccountTreeProps) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof accounts>();
    accounts.forEach((a) => {
      if (!groups.has(a.account_type)) groups.set(a.account_type, []);
      groups.get(a.account_type)!.push(a);
    });
    return groups;
  }, [accounts]);

  const typeOrder = ["asset", "liability", "equity", "revenue", "expense"];
  const filteredTypes = typeOrder.filter((t) => grouped.has(t));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <button
        className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${
          !selectedAccountId ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary"
        }`}
        onClick={() => onSelectAccount(null, null)}
      >
        All Accounts
      </button>

      <Accordion type="multiple" defaultValue={filteredTypes} className="space-y-1">
        {filteredTypes.map((type) => {
          const accts = grouped.get(type) || [];
          const filtered = search
            ? accts.filter((a) => a.account_name.toLowerCase().includes(search.toLowerCase()) || a.account_number.includes(search))
            : accts;

          if (filtered.length === 0 && search) return null;

          return (
            <AccordionItem key={type} value={type} className="border-none">
              <AccordionTrigger className="hover:no-underline py-2 px-2 text-sm">
                <div className="flex items-center gap-2 w-full">
                  <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[type]}`} />
                  <span className="font-medium text-xs uppercase tracking-wider">{TYPE_LABELS[type]}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <div className="space-y-0.5 pl-4">
                  {filtered.map((acct) => {
                    const isSelected = selectedAccountId === acct.id;
                    return (
                      <button
                        key={acct.id}
                        className={`w-full text-left text-xs px-3 py-2 rounded transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-secondary text-foreground"
                        }`}
                        onClick={() => onSelectAccount(acct.id, acct.account_name)}
                      >
                        <span className="truncate">
                          {acct.account_number} — {acct.account_name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
