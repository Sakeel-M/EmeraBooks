import { useOrg } from "./useOrg";

export function useFeatureAccess() {
  const { org } = useOrg();
  const lockedFeatures: string[] = (org as any)?.locked_features ?? [];

  const isFeatureLocked = (featureKey: string) => lockedFeatures.includes(featureKey);
  const isFeatureAvailable = (featureKey: string) => !lockedFeatures.includes(featureKey);

  return { isFeatureLocked, isFeatureAvailable, lockedFeatures };
}
