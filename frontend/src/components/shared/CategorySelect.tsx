import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  type: "vendor" | "bill" | "invoice" | "all";
  placeholder?: string;
}

export function CategorySelect({ value, onChange, type, placeholder = "Select category" }: CategorySelectProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .or(`type.eq.${type},type.eq.all`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!newCategory.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase.from("categories").insert({
        name: newCategory.trim(),
        type,
        user_id: user.id,
      });
      if (error) throw error;
      
      onChange(newCategory.trim());
      setNewCategory("");
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
    } catch {
      toast.error("Failed to create category");
    }
  };

  if (isCreating) {
    return (
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category name"
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          autoFocus
        />
        <Button type="button" size="sm" onClick={handleCreate}>Add</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsCreating(false)}>✕</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value || "uncategorized"} onValueChange={(v) => onChange(v === "uncategorized" ? "" : v)}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="uncategorized">Uncategorized</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreating(true)} className="shrink-0">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
