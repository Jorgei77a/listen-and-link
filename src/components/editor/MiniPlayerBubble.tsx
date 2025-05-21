
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniPlayerBubbleProps {
  position: { x: number, y: number };
  isPlaying: boolean;
  currentTime: number;
  onPlayPause: () => void;
  onDragEnd?: (position: { x: number, y: number }) => void;
  autoHideDelay?: number;
}

export function MiniPlayerBubble({
  position,
  isPlaying,
  currentTime,
  onPlayPause,
  onDragEnd,
  autoHideDelay = 4000
}: MiniPlayerBubbleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(position);
  const [isVisible, setIsVisible] = useState(true);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  
  // Format the current time in MM:SS format
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Reset auto-hide timer whenever there's interaction
  const resetAutoHideTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelay);
  };

  // Set up initial auto-hide timer
  useEffect(() => {
    resetAutoHideTimer();
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [autoHideDelay]);

  // Handle user interaction events
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && bubbleRef.current) {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      setCurrentPosition({ x: newX, y: newY });
      resetAutoHideTimer();
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (onDragEnd) {
        onDragEnd(currentPosition);
      }
    }
  };

  // Add mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle mouse down to start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      dragStartPos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
      resetAutoHideTimer();
    }
  };

  // Handle play/pause button click
  const handlePlayPauseClick = () => {
    onPlayPause();
    resetAutoHideTimer();
  };

  return createPortal(
    <div
      ref={bubbleRef}
      className={cn(
        "fixed flex items-center p-1 pl-3 pr-2 bg-background border rounded-full shadow-md z-50 transition-opacity duration-300",
        isDragging && "cursor-grabbing",
        !isVisible && "opacity-0 pointer-events-none"
      )}
      style={{
        left: `${currentPosition.x}px`,
        top: `${currentPosition.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={resetAutoHideTimer}
    >
      <span className="text-xs font-mono mr-2">{formatTime(currentTime)}</span>
      
      <Button 
        onClick={handlePlayPauseClick} 
        variant="ghost" 
        size="sm"
        className="h-6 w-6 rounded-full p-0"
      >
        {isPlaying ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3 ml-0.5" />
        )}
      </Button>
    </div>,
    document.body
  );
}
