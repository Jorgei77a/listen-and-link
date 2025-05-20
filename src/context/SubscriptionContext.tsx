
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SubscriptionInfo, Feature, SubscriptionTier, UserSubscription } from "@/types/subscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Default values for feature limitations
export const TIER_LIMITS = {
  free: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    exportFormats: ['plain'] as const,
    customTitles: false,
  },
  pro: {
    maxFileSize: 30 * 1024 * 1024, // 30MB
    exportFormats: ['plain', 'markdown'] as const,
    customTitles: true,
  },
  business: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    exportFormats: ['plain', 'markdown'] as const,
    customTitles: true,
    speakerDetection: true,
  },
  enterprise: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    exportFormats: ['plain', 'markdown'] as const,
    customTitles: true,
    speakerDetection: true,
    batchProcessing: true,
    premiumModels: true,
  },
} as const;

type TierLimits = typeof TIER_LIMITS;
type TierDetails<T extends SubscriptionTier> = TierLimits[T];

interface SubscriptionContextType {
  currentTier: SubscriptionTier;
  isLoading: boolean;
  hasFeature: (featureKey: string) => boolean;
  getTierLimits: <K extends keyof TierDetails<SubscriptionTier>>(limitKey: K) => any;
  tiers: SubscriptionInfo[];
  userSubscription: UserSubscription | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [tiers, setTiers] = useState<SubscriptionInfo[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);

  // Load subscription tiers and features
  useEffect(() => {
    async function loadSubscriptionData() {
      try {
        // Fetch all subscription tiers
        const { data: tiersData, error: tiersError } = await supabase
          .from('subscription_tiers')
          .select('*');

        if (tiersError) {
          console.error('Error fetching subscription tiers:', tiersError);
          return;
        }

        // Fetch all features
        const { data: featuresData, error: featuresError } = await supabase
          .from('features')
          .select('*');

        if (featuresError) {
          console.error('Error fetching features:', featuresError);
          return;
        }

        // Fetch tier features mapping
        const { data: tierFeaturesData, error: tierFeaturesError } = await supabase
          .from('tier_features')
          .select('*');

        if (tierFeaturesError) {
          console.error('Error fetching tier features:', tierFeaturesError);
          return;
        }

        // Process the data to create a complete tier information object
        const processedTiers = tiersData.map(tier => {
          const tierFeatures = tierFeaturesData
            .filter(tf => tf.tier_id === tier.id)
            .map(tf => {
              return featuresData.find(f => f.id === tf.feature_id);
            })
            .filter(Boolean) as Feature[];

          return {
            ...tier,
            name: tier.name as SubscriptionTier, // Cast the name to SubscriptionTier
            features: tierFeatures,
          };
        });

        setTiers(processedTiers as SubscriptionInfo[]);
        setFeatures(featuresData);

        // In a real app, we would fetch the user's subscription here
        // For now, set to free tier as default
        setCurrentTier('free');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load subscription data:', error);
        toast.error('Failed to load subscription data');
        setIsLoading(false);
      }
    }

    loadSubscriptionData();
  }, []);

  // Check if a feature is available in the current tier
  const hasFeature = (featureKey: string): boolean => {
    if (isLoading) return false;
    
    // Find the current tier object
    const tier = tiers.find(t => t.name === currentTier);
    if (!tier) return false;
    
    // Check if the feature exists in this tier
    return tier.features.some(f => f.key === featureKey);
  };

  // Get tier-specific limits
  const getTierLimits = <K extends keyof TierDetails<SubscriptionTier>>(limitKey: K): any => {
    return TIER_LIMITS[currentTier][limitKey];
  };

  return (
    <SubscriptionContext.Provider
      value={{
        currentTier,
        isLoading,
        hasFeature,
        getTierLimits,
        tiers,
        userSubscription
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
