
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
  className?: string;
}

export function InteractiveTranscript({
  segments,
  currentTime,
  onSegmentClick,
  className
}: InteractiveTranscriptProps) {
  const [activeSegment, setActiveSegment] = useState<TranscriptSegment | null>(null);
  const segmentRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const lastClickTimeRef = useRef<number>(0);

  // Find and set the active segment based on current time
  useEffect(() => {
    const newActiveSegment = findActiveSegment(currentTime, segments);
    
    if (!isSameSegment(newActiveSegment, activeSegment)) {
      setActiveSegment(newActiveSegment);
    }
  }, [currentTime, segments, activeSegment]);

  // Scroll the active segment into view when it changes
  useEffect(() => {
    if (activeSegment) {
      const activeElement = segmentRefs.current.get(activeSegment.start);
      
      // Only scroll if we haven't clicked recently (to avoid fighting with user scrolling)
      const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
      if (timeSinceLastClick > 1000) { // 1 second threshold
        scrollElementIntoView(activeElement || null);
      }
    }
  }, [activeSegment]);

  // Handle segment click with debounce to prevent double-processing
  const handleSegmentClick = (segment: TranscriptSegment) => {
    // Update last click time
    lastClickTimeRef.current = Date.now();
    
    // Call the parent handler
    onSegmentClick(segment);
  };

  return (
    <ScrollArea className={className || "h-[400px]"}>
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
