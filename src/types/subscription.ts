
export type SubscriptionTier = 'free' | 'pro' | 'business' | 'enterprise';

export interface Feature {
  id: number;
  key: string;
  name: string;
  description: string | null;
}

export interface TierFeature {
  tier_id: number;
  feature_id: number;
}

export interface SubscriptionInfo {
  id: number;
  name: SubscriptionTier;
  description: string | null;
  features: Feature[];
}

export interface UserSubscription {
  id: string;
  user_id: string | null;
  tier_id: number;
  is_active: boolean | null;
  expires_at: string | null;
}
