
import { useSubscription } from "@/context/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SubscriptionBadgeProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

export function SubscriptionBadge({
  className,
  size = "default",
  showLabel = true,
}: SubscriptionBadgeProps) {
  const { currentTier, isLoading } = useSubscription();
  
  if (isLoading) {
    return <Badge variant="outline" className={cn("animate-pulse", className)}>Loading...</Badge>;
  }

  // Define styles based on tier
  const tierStyles = {
    free: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    pro: "bg-blue-500 text-white hover:bg-blue-600",
    business: "bg-purple-500 text-white hover:bg-purple-600",
    enterprise: "bg-amber-500 text-white hover:bg-amber-600",
  };

  // Define sizes
  const sizeStyles = {
    sm: "text-xs py-0 px-2",
    default: "",
    lg: "text-sm py-0.5 px-3",
  };

  // Format tier name for display
  const tierDisplay = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);
  
  return (
    <Badge 
      className={cn(
        tierStyles[currentTier as keyof typeof tierStyles],
        sizeStyles[size],
        className
      )}
    >
      {showLabel ? `${tierDisplay} Plan` : tierDisplay}
    </Badge>
  );
}
