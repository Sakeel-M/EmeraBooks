import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrency(): { currency: string; isLoading: boolean } {
  const { data: currency = "USD", isLoading } = useQuery({
    queryKey: ["user-currency"],
    queryFn: async () => {
      // Try user_preferences first
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("preferred_currency")
        .maybeSingle();

      if (prefs?.preferred_currency) return prefs.preferred_currency;

      // Fall back to latest uploaded file's currency
      const { data: files } = await supabase
        .from("uploaded_files")
        .select("currency")
        .order("created_at", { ascending: false })
        .limit(1);

      if (files && files.length > 0 && files[0].currency) return files[0].currency;

      return "USD";
    },
    staleTime: 0,
  });

  return { currency, isLoading };
}
