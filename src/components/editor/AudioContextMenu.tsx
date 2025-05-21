
import { 
  Play, SkipBack, Pause
} from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

interface AudioContextMenuProps {
  children: ReactNode;
  position: { x: number, y: number } | null;
  hasTimestamp: boolean;
  isPlaying: boolean;
  onPlayFromHere: () => void;
  onPlayEarlier: () => void;
  onPause: () => void;
  onClose: () => void;
}

export function AudioContextMenu({
  children,
  position,
  hasTimestamp,
  isPlaying,
  onPlayFromHere,
  onPlayEarlier,
  onPause,
  onClose
}: AudioContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside to close the menu
  useEffect(() => {
    if (!position) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      // Stop propagation to prevent other handlers from firing
      e.stopPropagation();
      
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Add click listener with a small delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 10);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [position, onClose]);

  // If no position, just render the children
  if (!position) {
    return <>{children}</>;
  }
  
  // Render the context menu at the specified position
  return (
    <>
      {children}
      <div 
        ref={menuRef}
        className="audio-context-menu"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999 // Ensure menu is on top
        }}
        onMouseDown={(e) => e.stopPropagation()} // Stop event propagation
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className={`audio-context-menu-item ${!hasTimestamp ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasTimestamp) onPlayFromHere();
          }}
          disabled={!hasTimestamp}
        >
          <div className="flex items-center">
            <Play className="h-4 w-4 mr-2" />
            Play from here
          </div>
        </button>
        
        <button 
          className={`audio-context-menu-item ${!hasTimestamp ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasTimestamp) onPlayEarlier();
          }}
          disabled={!hasTimestamp}
        >
          <div className="flex items-center">
            <SkipBack className="h-4 w-4 mr-2" />
            Play 5s earlier
          </div>
        </button>
        
        <button 
          className={`audio-context-menu-item ${!isPlaying ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isPlaying) onPause();
          }}
          disabled={!isPlaying}
        >
          <div className="flex items-center">
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </div>
        </button>
      </div>
    </>
  );
}
