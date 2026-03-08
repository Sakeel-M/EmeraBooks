import { useActiveClient } from "./useActiveClient";

export function useCurrency() {
  const { currency, isLoading } = useActiveClient();

  return {
    currency: currency || "USD",
    isLoading,
  };
}
