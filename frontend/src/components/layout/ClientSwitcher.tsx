import { useMemo } from "react";
import { ChevronsUpDown, Building2, Plus, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useOrg } from "@/hooks/useOrg";
import { useNavigate } from "react-router-dom";

export function ClientSwitcher() {
  const { client, switchClient, isSwitching, isParent } = useActiveClient();
  const { clients } = useOrg();
  const navigate = useNavigate();

  // Organize: parents first with children nested below
  const hierarchicalClients = useMemo(() => {
    const parents = clients.filter((c: any) => !c.parent_id);
    const children = clients.filter((c: any) => c.parent_id);
    const result: { client: any; isChild: boolean }[] = [];

    parents.forEach((p: any) => {
      result.push({ client: p, isChild: false });
      children
        .filter((c: any) => c.parent_id === p.id)
        .forEach((c: any) => result.push({ client: c, isChild: true }));
    });

    // Orphan children
    const listed = new Set(result.map((r) => r.client.id));
    children.filter((c: any) => !listed.has(c.id)).forEach((c: any) =>
      result.push({ client: c, isChild: true }),
    );

    return result;
  }, [clients]);

  if (!client) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 max-w-[280px]"
          disabled={isSwitching}
        >
          {isParent ? (
            <Shield className="h-4 w-4 flex-shrink-0 text-primary" />
          ) : (
            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium">{client.name}</span>
          {isParent && (
            <Badge className="text-[7px] h-4 bg-primary/80 shrink-0">Main</Badge>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Accounts
        </DropdownMenuLabel>
        {hierarchicalClients.map(({ client: c, isChild }) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => {
              if (c.id !== client.id) switchClient(c.id);
            }}
            className={`cursor-pointer ${c.id === client.id ? "bg-accent font-medium" : ""} ${isChild ? "pl-8" : ""}`}
          >
            {isChild ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground mr-1.5 shrink-0" />
            ) : c.is_parent ? (
              <Shield className="mr-2 h-4 w-4 flex-shrink-0 text-primary" />
            ) : (
              <Building2 className="mr-2 h-4 w-4 flex-shrink-0" />
            )}
            <span className="truncate flex-1">{c.name}</span>
            {c.is_parent && (
              <Badge className="text-[7px] h-3.5 bg-primary/80 ml-1.5 shrink-0">Main</Badge>
            )}
            {isChild && (
              <span className="text-[9px] text-muted-foreground ml-1 shrink-0">Sub</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/settings?tab=clients")}
          className="cursor-pointer text-muted-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
