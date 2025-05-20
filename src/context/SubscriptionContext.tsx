
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
    maxMonthlyMinutes: 300, // 5 hours per month
  },
  pro: {
    maxFileSize: 30 * 1024 * 1024, // 30MB
    exportFormats: ['plain', 'markdown'] as const,
    customTitles: true,
    maxMonthlyMinutes: 1500, // 25 hours per month
  },
  business: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    exportFormats: ['plain', 'markdown'] as const,
    customTitles: true,
    speakerDetection: true,
    maxMonthlyMinutes: 6000, // 100 hours per month
  },
  enterprise: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    exportFormats: ['plain', 'markdown'] as const,
    customTitles: true,
    speakerDetection: true,
    batchProcessing: true,
    premiumModels: true,
    maxMonthlyMinutes: Number.MAX_SAFE_INTEGER, // Unlimited
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
  userUsage: {
    minutesUsed: number;
    monthlyLimit: number;
    percentUsed: number;
  } | null;
  checkMonthlyUsage: (durationInSeconds: number) => boolean;
  updateMonthlyUsage: (durationInSeconds: number) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [tiers, setTiers] = useState<SubscriptionInfo[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [userUsage, setUserUsage] = useState<SubscriptionContextType['userUsage']>(null);

  // Get current month in YYYY-MM format
  const getCurrentMonth = (): string => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

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
        
        // Fetch user usage for the current month
        await loadUserUsage();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load subscription data:', error);
        toast.error('Failed to load subscription data');
        setIsLoading(false);
      }
    }

    loadSubscriptionData();
  }, []);

  // Load user's current monthly usage
  const loadUserUsage = async () => {
    try {
      const user = supabase.auth.getSession();
      if (!user) return;
      
      const currentMonth = getCurrentMonth();
      
      // Fetch user's usage record for current month
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('month_year', currentMonth)
        .maybeSingle();
      
      if (usageError && usageError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user usage:', usageError);
        return;
      }
      
      // Calculate usage metrics
      const minutesUsed = usageData?.minutes_used || 0;
      const monthlyLimit = TIER_LIMITS[currentTier].maxMonthlyMinutes;
      const percentUsed = Math.min((minutesUsed / monthlyLimit) * 100, 100);
      
      setUserUsage({
        minutesUsed,
        monthlyLimit,
        percentUsed
      });
      
    } catch (error) {
      console.error('Failed to load user usage data:', error);
    }
  };

  // Check if user has enough monthly usage remaining
  const checkMonthlyUsage = (durationInSeconds: number): boolean => {
    if (isLoading || !userUsage) return true; // Allow if still loading or no usage data
    
    // Convert duration from seconds to minutes
    const durationInMinutes = durationInSeconds / 60;
    
    // Check if adding this duration would exceed the monthly limit
    return (userUsage.minutesUsed + durationInMinutes) <= userUsage.monthlyLimit;
  };

  // Update user's monthly usage after transcription
  const updateMonthlyUsage = async (durationInSeconds: number): Promise<void> => {
    try {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;
      
      const currentMonth = getCurrentMonth();
      const durationInMinutes = durationInSeconds / 60;
      
      // Try to update existing record first
      const { data, error } = await supabase
        .from('user_usage')
        .upsert({
          user_id: user.id,
          month_year: currentMonth,
          minutes_used: userUsage ? userUsage.minutesUsed + durationInMinutes : durationInMinutes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,month_year'
        })
        .select();
      
      if (error) {
        console.error('Error updating usage:', error);
        return;
      }
      
      // Refresh usage data
      await loadUserUsage();
      
    } catch (error) {
      console.error('Failed to update usage data:', error);
    }
  };

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
        userSubscription,
        userUsage,
        checkMonthlyUsage,
        updateMonthlyUsage
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
