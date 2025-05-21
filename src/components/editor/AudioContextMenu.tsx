
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from "@/components/ui/context-menu";
import { ReactNode } from "react";
import { Play, SkipBack, Pause, Info } from "lucide-react";

interface AudioContextMenuProps {
  children: ReactNode;
  hasTimestamp: boolean;
  isPlaying: boolean;
  onPlayFromHere: () => void;
  onPlayEarlier: () => void;
  onPause: () => void;
  className?: string;
  onContextMenu?: (e: React.MouseEvent) => void; // Add this to handle manual context menu opening
}

export function AudioContextMenu({
  children,
  hasTimestamp,
  isPlaying,
  onPlayFromHere,
  onPlayEarlier,
  onPause,
  className,
  onContextMenu
}: AudioContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextMenu}>
        <div className={className}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          disabled={!hasTimestamp}
          onClick={onPlayFromHere}
          className="flex items-center cursor-pointer"
        >
          <Play className="h-4 w-4 mr-2" />
          Play from here
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasTimestamp}
          onClick={onPlayEarlier}
          className="flex items-center cursor-pointer"
        >
          <SkipBack className="h-4 w-4 mr-2" />
          Play 5s earlier
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!isPlaying}
          onClick={onPause}
          className="flex items-center cursor-pointer"
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause
        </ContextMenuItem>
        {!hasTimestamp && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled className="flex items-center text-muted-foreground">
              <Info className="h-4 w-4 mr-2" />
              No original audio for this text
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
