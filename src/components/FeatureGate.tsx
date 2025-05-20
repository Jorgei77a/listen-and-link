
import { ReactNode } from "react";
import { useSubscription } from "@/context/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { LockIcon, BeakerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  description?: string;
  hideOnDisabled?: boolean;
  showBadge?: boolean;
}

export function FeatureGate({
  featureKey,
  children,
  fallback,
  description,
  hideOnDisabled = false,
  showBadge = true,
}: FeatureGateProps) {
  const { hasFeature, currentTier, isLoading } = useSubscription();

  const isEnabled = hasFeature(featureKey);
  const isTestingFeature = currentTier === 'free'; // Temporary indicator for testing mode

  // Loading state
  if (isLoading) {
    return <div className="animate-pulse bg-muted h-8 w-full rounded"></div>;
  }

  // If feature is enabled, show the children
  if (isEnabled) {
    return (
      <div className="relative">
        {showBadge && (
          <Badge 
            variant={isTestingFeature ? "outline" : "secondary"}
            className={cn(
              "absolute -top-2 -right-2 text-xs z-10", 
              isTestingFeature ? "border-amber-500 text-amber-500" : "opacity-70"
            )}
          >
            {isTestingFeature ? (
              <span className="flex items-center gap-1">
                <BeakerIcon className="h-3 w-3" />
                Testing
              </span>
            ) : (
              currentTier
            )}
          </Badge>
        )}
        {children}
      </div>
    );
  }

  // If feature is disabled and we want to hide it completely
  if (hideOnDisabled) {
    return null;
  }

  // Show fallback content or disabled state
  const upgradeMessage = description || `This feature requires a higher plan than ${currentTier}.`;
  
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div 
      className={cn(
        "relative p-4 border border-dashed rounded-lg",
        "bg-muted/50 text-muted-foreground",
        "flex flex-col items-center justify-center",
        "min-h-[100px]"
      )}
    >
      <LockIcon className="mb-2 h-5 w-5" />
      <p className="text-sm text-center">{upgradeMessage}</p>
      <Badge variant="outline" className="mt-2">
        Available on higher tiers
      </Badge>
    </div>
  );
}
