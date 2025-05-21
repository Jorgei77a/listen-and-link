
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger 
} from "@/components/ui/context-menu";
import { ReactNode } from "react";
import { Play, SkipBack, Pause } from "lucide-react";

interface AudioContextMenuProps {
  children: ReactNode;
  hasTimestamp: boolean;
  isPlaying: boolean;
  onPlayFromHere: () => void;
  onPlayEarlier: () => void;
  onPause: () => void;
}

export function AudioContextMenu({
  children,
  hasTimestamp,
  isPlaying,
  onPlayFromHere,
  onPlayEarlier,
  onPause
}: AudioContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
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
      </ContextMenuContent>
    </ContextMenu>
  );
}
