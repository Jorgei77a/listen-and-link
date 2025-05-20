
import React, { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  findActiveSegment, 
  scrollElementIntoView, 
  isSameSegment,
  type TranscriptSegment 
} from "@/utils/transcriptSyncUtils";

interface InteractiveTranscriptProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSegmentClick: (segment: TranscriptSegment) => void;
  isPlaying?: boolean;
  className?: string;
}

export function InteractiveTranscript({
  segments,
  currentTime,
  onSegmentClick,
  isPlaying = false,
  className
}: InteractiveTranscriptProps) {
  const [activeSegment, setActiveSegment] = useState<TranscriptSegment | null>(null);
  const segmentRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const lastClickTimeRef = useRef<number>(0);
  const shouldScrollRef = useRef<boolean>(true);

  // Find and set the active segment based on current time
  useEffect(() => {
    const newActiveSegment = findActiveSegment(currentTime, segments);
    
    if (!isSameSegment(newActiveSegment, activeSegment)) {
      setActiveSegment(newActiveSegment);
      
      // Enable auto-scrolling only when playing or when the time changes significantly
      if (isPlaying || Math.abs((activeSegment?.start || 0) - (newActiveSegment?.start || 0)) > 5) {
        shouldScrollRef.current = true;
      }
    }
  }, [currentTime, segments, activeSegment, isPlaying]);

  // Scroll the active segment into view when it changes
  useEffect(() => {
    if (activeSegment && shouldScrollRef.current) {
      const activeElement = segmentRefs.current.get(activeSegment.start);
      
      // Only scroll if we haven't clicked recently (to avoid fighting with user scrolling)
      const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
      if (timeSinceLastClick > 1000 && isPlaying) { // Only auto-scroll when playing
        scrollElementIntoView(activeElement || null);
      }
    }
  }, [activeSegment, isPlaying]);

  // Temporarily disable auto-scrolling when user interacts
  const handleUserScroll = () => {
    shouldScrollRef.current = false;
    
    // Re-enable auto-scrolling after some time without user interaction
    setTimeout(() => {
      shouldScrollRef.current = isPlaying; // Only re-enable if still playing
    }, 5000);
  };

  // Handle segment click with debounce to prevent double-processing
  const handleSegmentClick = (segment: TranscriptSegment) => {
    // Update last click time
    lastClickTimeRef.current = Date.now();
    
    // Disable auto-scrolling temporarily after a user click
    shouldScrollRef.current = false;
    
    // Call the parent handler
    onSegmentClick(segment);
  };

  return (
    <ScrollArea className={className || "h-[400px]"} onWheel={handleUserScroll} onTouchMove={handleUserScroll}>
      <div className="space-y-2 p-4">
        {segments.map((segment) => {
          const isActive = activeSegment?.start === segment.start;
          
          return (
            <p
              key={segment.start}
              ref={(el) => {
                if (el) segmentRefs.current.set(segment.start, el);
              }}
              className={`p-2 rounded transition-colors cursor-pointer 
                ${isActive ? 'bg-primary/10 border-l-4 border-primary pl-3' : 'hover:bg-muted/50'}`}
              onClick={() => handleSegmentClick(segment)}
              title={`Start: ${formatTime(segment.start)}`}
            >
              {segment.text}
            </p>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Helper function to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
