import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InvoicePreview } from "./InvoicePreview";
import { Palette } from "lucide-react";

interface InvoiceTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATES = [
  { id: "classic", label: "Classic", desc: "Logo top-left, clean layout" },
  { id: "modern", label: "Modern", desc: "Full-width colored header" },
  { id: "minimal", label: "Minimal", desc: "Simple, elegant typography" },
];

export function InvoiceTemplateEditor({ open, onOpenChange }: InvoiceTemplateEditorProps) {
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState("classic");
  const [accentColor, setAccentColor] = useState("#1F4F2D");
  const [showTax, setShowTax] = useState(true);
  const [showTerms, setShowTerms] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [footerText, setFooterText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences-template"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (prefs) {
      setTemplate((prefs as any).invoice_template || "classic");
      setAccentColor((prefs as any).invoice_accent_color || "#1F4F2D");
      setShowTax((prefs as any).invoice_show_tax ?? true);
      setShowTerms((prefs as any).invoice_show_terms ?? true);
      setShowNotes((prefs as any).invoice_show_notes ?? true);
      setFooterText((prefs as any).invoice_footer_text || "");
    }
  }, [prefs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const updateData = {
        invoice_template: template,
        invoice_accent_color: accentColor,
        invoice_show_tax: showTax,
        invoice_show_terms: showTerms,
        invoice_show_notes: showNotes,
        invoice_footer_text: footerText || null,
      };
      if (prefs) {
        await supabase.from("user_preferences").update(updateData).eq("user_id", user.id);
      } else {
        await supabase.from("user_preferences").insert({ ...updateData, user_id: user.id });
      }
      queryClient.invalidateQueries({ queryKey: ["user-preferences-template"] });
      queryClient.invalidateQueries({ queryKey: ["user-preferences-profile"] });
      toast.success("Template settings saved");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const sampleInvoice = {
    invoice_number: "INV-00001",
    invoice_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    customers: { name: "Acme Corp", email: "billing@acme.com" },
    terms: showTerms ? "Net 30" : undefined,
    notes: showNotes ? "Thank you for your business" : undefined,
  };

  const sampleItems = [
    { description: "Consulting Services", quantity: 10, unit_price: 150, tax_rate: showTax ? 8 : 0 },
    { description: "Design Package", quantity: 1, unit_price: 2500, tax_rate: showTax ? 8 : 0 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Customize Invoice Template
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings */}
          <div className="space-y-6">
            {/* Layout */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Layout</Label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      template === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-14 rounded border border-border cursor-pointer"
                />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-28 font-mono text-sm" />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Show / Hide Fields</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tax Column</span>
                  <Switch checked={showTax} onCheckedChange={setShowTax} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Terms</span>
                  <Switch checked={showTerms} onCheckedChange={setShowTerms} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Notes</span>
                  <Switch checked={showNotes} onCheckedChange={setShowNotes} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Footer Text</Label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Thank you for your business!"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Template Settings"}
            </Button>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Preview</Label>
            <div className="border border-border rounded-lg overflow-hidden bg-muted/30 p-2">
              <InvoicePreview
                invoice={sampleInvoice}
                companyProfile={prefs}
                templateSettings={{
                  invoice_template: template,
                  invoice_accent_color: accentColor,
                  invoice_show_tax: showTax,
                  invoice_show_terms: showTerms,
                  invoice_show_notes: showNotes,
                  invoice_footer_text: footerText,
                }}
                items={sampleItems}
                compact
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
