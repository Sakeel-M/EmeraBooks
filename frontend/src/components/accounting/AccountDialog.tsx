import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: any;
  onSaved: () => void;
}

interface FormData {
  account_number: string;
  account_name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  description: string;
}

export function AccountDialog({ open, onOpenChange, account, onSaved }: Props) {
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { account_number: "", account_name: "", account_type: "asset", description: "" },
  });

  useEffect(() => {
    if (open) {
      if (account) {
        reset({ account_number: account.account_number, account_name: account.account_name, account_type: account.account_type, description: account.description || "" });
      } else {
        reset({ account_number: "", account_name: "", account_type: "asset", description: "" });
      }
    }
  }, [open, account, reset]);

  const onSubmit = async (data: FormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (account) {
      const { error } = await supabase.from("accounts").update(data).eq("id", account.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Account updated");
    } else {
      const { error } = await supabase.from("accounts").insert({ ...data, user_id: user.id });
      if (error) { toast.error(error.message.includes("duplicate") ? "Account number already exists" : "Failed to create"); return; }
      toast.success("Account created");
    }
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input {...register("account_number", { required: true })} placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={watch("account_type")} onValueChange={v => setValue("account_type", v as "asset" | "liability" | "equity" | "revenue" | "expense")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input {...register("account_name", { required: true })} placeholder="Cash" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea {...register("description")} placeholder="Optional description" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{account ? "Save" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
