import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Sparkles } from "lucide-react";
import { type ReconciliationSettings as SettingsType } from "@/lib/reconciliation";

interface ReconciliationSettingsProps {
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
}

export function ReconciliationSettings({
  settings,
  onSettingsChange,
}: ReconciliationSettingsProps) {
  const toggleMatch = (key: "matchByAmount" | "matchByDate" | "matchByDescription") => {
    onSettingsChange({ ...settings, [key]: !settings[key] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Reconciliation Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Match By */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Match By</Label>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={settings.matchByAmount ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleMatch("matchByAmount")}
            >
              Amount
            </Badge>
            <Badge
              variant={settings.matchByDate ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleMatch("matchByDate")}
            >
              Date
            </Badge>
            <Badge
              variant={settings.matchByDescription ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleMatch("matchByDescription")}
            >
              Description
            </Badge>
          </div>
        </div>

        {/* Date Tolerance */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Date Tolerance</Label>
          <Select
            value={String(settings.dateTolerance)}
            onValueChange={(value) =>
              onSettingsChange({ ...settings, dateTolerance: Number(value) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Exact match</SelectItem>
              <SelectItem value="1">± 1 day</SelectItem>
              <SelectItem value="3">± 3 days</SelectItem>
              <SelectItem value="7">± 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Amount Tolerance */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Amount Tolerance</Label>
          <Select
            value={settings.amountTolerance}
            onValueChange={(value: 'exact' | 'cents' | 'percent') =>
              onSettingsChange({ ...settings, amountTolerance: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exact">Exact match</SelectItem>
              <SelectItem value="cents">Within $0.01</SelectItem>
              <SelectItem value="percent">Within 1%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* AI Matching */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <Label className="text-sm font-medium">AI Matching</Label>
              <p className="text-xs text-muted-foreground">
                Smart description matching
              </p>
            </div>
          </div>
          <Switch
            checked={settings.aiMatching}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, aiMatching: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
