import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import { getSectorStyle } from "@/lib/sectorStyles";
import { PREDEFINED_SECTORS } from "@/lib/predefinedSectors";

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "vendor" | "bill" | "invoice" | "all";
  existingCategories?: string[];
  /** If provided, only show sectors that appear in this list (based on name). Falls back to full list if empty. */
  availableSectors?: string[];
  onCategoryClick?: (category: string) => void;
}

export function CategoryManager({ open, onOpenChange, type, availableSectors, onCategoryClick }: CategoryManagerProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [catSearch, setCatSearch] = useState("");
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

  // Determine which sectors to display:
  // If availableSectors is provided and non-empty, filter PREDEFINED_SECTORS to only those present.
  // Otherwise show all predefined sectors.
  const sectorsToShow = useMemo(() => {
    if (availableSectors && availableSectors.length > 0) {
      const sectorSet = new Set(availableSectors.map((s) => s.toLowerCase()));
      return PREDEFINED_SECTORS.filter((s) => sectorSet.has(s.name.toLowerCase()));
    }
    return PREDEFINED_SECTORS;
  }, [availableSectors]);

  const filteredSectors = useMemo(() => {
    if (!catSearch.trim()) return sectorsToShow;
    const q = catSearch.toLowerCase();
    return sectorsToShow.filter((s) => s.name.toLowerCase().includes(q));
  }, [catSearch, sectorsToShow]);

  const filteredCustom = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("categories").insert({
        name: newName.trim(),
        type,
        user_id: user.id,
      });
      if (error) throw error;
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
    } catch {
      toast.error("Failed to create category");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const { error } = await supabase.from("categories").update({ name: editName.trim() }).eq("id", id);
      if (error) throw error;
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated");
    } catch {
      toast.error("Failed to update category");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    } catch {
      toast.error("Failed to delete category");
    }
  };

  const handleSectorClick = (sectorName: string) => {
    onCategoryClick?.(sectorName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        {/* Add new category */}
        <div className="flex gap-2 flex-shrink-0">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          />
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
            placeholder="Search categories..."
            className="pl-9"
          />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">

          {/* Suggested Sectors — filtered to only relevant ones */}
          {filteredSectors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {availableSectors && availableSectors.length > 0 ? "Sectors in Your Data" : "Suggested Sectors"}
              </p>
              <div className="flex flex-wrap gap-2">
                {filteredSectors.map((sector, i) => {
                  const style = getSectorStyle(sector.key, i);
                  const Icon = style.icon ?? null;
                  return (
                    <button
                      key={sector.name}
                      onClick={() => handleSectorClick(sector.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:opacity-80 cursor-pointer ${style.bgColor} ${style.textColor} ${style.borderColor}`}
                    >
                      {Icon && <Icon className="h-3 w-3" />}
                      {sector.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No sectors in data fallback */}
          {filteredSectors.length === 0 && availableSectors && availableSectors.length > 0 && !catSearch && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No sector matches found in your current data.
            </p>
          )}

          {/* Your Custom Categories */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Custom Categories
            </p>
            {filteredCustom.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {catSearch ? "No matching custom categories" : "No custom categories yet — add one above"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredCustom.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate(cat.id)}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleUpdate(cat.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <Badge variant="secondary" className="text-xs">{cat.type}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(cat.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
