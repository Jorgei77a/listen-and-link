
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger 
} from "@/components/ui/context-menu";
import { ReactNode, useState, useEffect, useRef } from "react";
import { Play, SkipBack, Pause } from "lucide-react";

interface AudioContextMenuProps {
  children: ReactNode;
  hasTimestamp: boolean;
  isPlaying: boolean;
  onPlayFromHere: () => void;
  onPlayEarlier: () => void;
  onPause: () => void;
  position?: { x: number, y: number } | null;
  onClose?: () => void;
}

export function AudioContextMenu({
  children,
  hasTimestamp,
  isPlaying,
  onPlayFromHere,
  onPlayEarlier,
  onPause,
  position,
  onClose
}: AudioContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle custom positioning for right-click context menu
  useEffect(() => {
    if (position) {
      setIsOpen(true);
      
      // Close when clicking outside
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          if (onClose) onClose();
        }
      };
      
      // Add click listener to document
      document.addEventListener('mousedown', handleClickOutside);
      
      // Clean up
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      setIsOpen(false);
    }
  }, [position, onClose]);
  
  // Custom positioned context menu
  if (position) {
    return (
      <div 
        ref={menuRef}
        className="absolute z-50 bg-popover text-popover-foreground rounded-md border shadow-md p-1 w-48"
        style={{
          display: isOpen ? 'block' : 'none',
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div 
          className={`flex items-center cursor-pointer px-2 py-1.5 text-sm rounded-sm ${!hasTimestamp ? 'opacity-50 pointer-events-none' : 'hover:bg-accent hover:text-accent-foreground'}`}
          onClick={() => {
            if (hasTimestamp) {
              onPlayFromHere();
              setIsOpen(false);
              if (onClose) onClose();
            }
          }}
        >
          <Play className="h-4 w-4 mr-2" />
          Play from here
        </div>
        <div 
          className={`flex items-center cursor-pointer px-2 py-1.5 text-sm rounded-sm ${!hasTimestamp ? 'opacity-50 pointer-events-none' : 'hover:bg-accent hover:text-accent-foreground'}`}
          onClick={() => {
            if (hasTimestamp) {
              onPlayEarlier();
              setIsOpen(false);
              if (onClose) onClose();
            }
          }}
        >
          <SkipBack className="h-4 w-4 mr-2" />
          Play 5s earlier
        </div>
        <div 
          className={`flex items-center cursor-pointer px-2 py-1.5 text-sm rounded-sm ${!isPlaying ? 'opacity-50 pointer-events-none' : 'hover:bg-accent hover:text-accent-foreground'}`}
          onClick={() => {
            if (isPlaying) {
              onPause();
              setIsOpen(false);
              if (onClose) onClose();
            }
          }}
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause
        </div>
      </div>
    );
  }

  // Regular context menu when using the default right-click behavior
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
