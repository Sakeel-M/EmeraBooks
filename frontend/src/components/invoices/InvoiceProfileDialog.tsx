import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Upload, X, Loader2 } from "lucide-react";

interface InvoiceProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export function InvoiceProfileDialog({ open, onOpenChange }: InvoiceProfileDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm({
    defaultValues: {
      company_name: "",
      company_email: "",
      company_address_line1: "",
      company_address_line2: "",
      company_city: "",
      company_state: "",
      company_zip: "",
    },
  });

  useEffect(() => {
    if (prefs) {
      form.reset({
        company_name: prefs.company_name || "",
        company_email: prefs.company_email || "",
        company_address_line1: prefs.company_address_line1 || "",
        company_address_line2: prefs.company_address_line2 || "",
        company_city: prefs.company_city || "",
        company_state: prefs.company_state || "",
        company_zip: prefs.company_zip || "",
      });
      setLogoUrl(prefs.company_logo_url || null);
    }
  }, [prefs, form]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("File must be under 2MB"); return; }
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) { toast.error("Only PNG or JPG allowed"); return; }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const path = `${user.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(path);

      // Save URL to user_preferences
      if (prefs) {
        await supabase.from("user_preferences").update({ company_logo_url: publicUrl }).eq("user_id", user.id);
      } else {
        await supabase.from("user_preferences").insert({ user_id: user.id, company_logo_url: publicUrl });
      }

      setLogoUrl(publicUrl + "?t=" + Date.now());
      queryClient.invalidateQueries({ queryKey: ["user-preferences-profile"] });
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("user_preferences").update({ company_logo_url: null }).eq("user_id", user.id);
      setLogoUrl(null);
      queryClient.invalidateQueries({ queryKey: ["user-preferences-profile"] });
      toast.success("Logo removed");
    } catch {
      toast.error("Failed to remove logo");
    }
  };

  const onSubmit = async (data: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (prefs) {
        const { error } = await supabase.from("user_preferences").update(data).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_preferences").insert({ ...data, user_id: user.id });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["user-preferences-profile"] });
      toast.success("Invoice profile saved");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save profile");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Invoice Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Company Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name</label>
                <Input {...form.register("company_name")} placeholder="Your Company" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input {...form.register("company_email")} type="email" placeholder="billing@company.com" />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Invoice Logo</label>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
              {logoUrl ? (
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                  <img src={logoUrl} alt="Company logo" className="h-16 w-16 object-contain rounded border bg-white" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Logo uploaded</p>
                    <p className="text-xs text-muted-foreground">Click replace to change</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      Replace
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 mx-auto text-muted-foreground mb-2 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  )}
                  <p className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Upload your company logo"}</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                </button>
              )}
            </div>
          </div>

          {/* Company Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Company Address</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Address Line 1</label>
                <Input {...form.register("company_address_line1")} placeholder="123 Main St" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address Line 2 (optional)</label>
                <Input {...form.register("company_address_line2")} placeholder="Suite 100" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input {...form.register("company_city")} placeholder="City" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Select value={form.watch("company_state")} onValueChange={(v) => form.setValue("company_state", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zip Code</label>
                  <Input {...form.register("company_zip")} placeholder="10001" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Profile</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
