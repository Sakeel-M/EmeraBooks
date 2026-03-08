import { ChevronsUpDown, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useOrg } from "@/hooks/useOrg";
import { useNavigate } from "react-router-dom";

export function ClientSwitcher() {
  const { client, switchClient, isSwitching } = useActiveClient();
  const { clients } = useOrg();
  const navigate = useNavigate();

  if (!client) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 max-w-[220px]"
          disabled={isSwitching}
        >
          <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{client.company_name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {clients.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => {
              if (c.id !== client.id) switchClient(c.id);
            }}
            className={`cursor-pointer ${c.id === client.id ? "bg-accent font-medium" : ""}`}
          >
            <Building2 className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">{c.company_name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/settings")}
          className="cursor-pointer text-muted-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
