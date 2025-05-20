
import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { findSegmentAtTime, SYNC_CONFIG } from "@/utils/audioSyncUtils";
import type { TranscriptSegment } from "@/utils/audioSyncUtils";

interface TimestampHighlighterProps {
  currentTimeInSeconds: number | null;
  segments: TranscriptSegment[];
}

export function TimestampHighlighter({ 
  currentTimeInSeconds, 
  segments 
}: TimestampHighlighterProps) {
  const [editor] = useLexicalComposerContext();
  const lastHighlightedRef = useRef<string | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  
  // Clear any pending scroll operations
  const clearScrollTimeout = () => {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  };
  
  // Update highlighting based on current playback time
  useEffect(() => {
    if (currentTimeInSeconds === null || !editor || segments.length === 0) return;
    
    const updateHighlighting = () => {
      editor.update(() => {
        try {
          // Find the current segment based on time
          const currentSegment = findSegmentAtTime(currentTimeInSeconds, segments, true);
          
          // Get all paragraph elements
          const root = $getRoot();
          const paragraphs = root.getChildren();
          
          // Track if we found a match
          let foundMatch = false;
          
          // Process each paragraph to update highlighting
          paragraphs.forEach((paragraph, index) => {
            const element = editor.getElementByKey(paragraph.getKey());
            if (!element) return;
            
            // Get time data from attributes
            const start = parseFloat(element.getAttribute('data-start') || '-1');
            const end = parseFloat(element.getAttribute('data-end') || '-1');
            
            // Skip elements without valid time attributes
            if (start < 0 || end < 0) return;
            
            // Check if this paragraph should be highlighted
            const shouldHighlight = (
              start <= currentTimeInSeconds && 
              currentTimeInSeconds <= (end + SYNC_CONFIG.segmentEndBuffer)
            );
            
            if (shouldHighlight) {
              foundMatch = true;
              
              // Apply highlighting class
              element.classList.add('bg-primary/10');
              
              // Only scroll if this is a new paragraph
              if (lastHighlightedRef.current !== paragraph.getKey()) {
                lastHighlightedRef.current = paragraph.getKey();
                
                // Clear any previous scroll operation
                clearScrollTimeout();
                
                // Debounce scrolling to prevent jumpy behavior
                scrollTimeoutRef.current = window.setTimeout(() => {
                  const rect = element.getBoundingClientRect();
                  const parentElement = element.parentElement;
                  
                  if (parentElement) {
                    const parentRect = parentElement.getBoundingClientRect();
                    
                    // Only scroll if the element is not fully visible
                    if (rect.bottom > parentRect.bottom || rect.top < parentRect.top) {
                      element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }
                  }
                  
                  scrollTimeoutRef.current = null;
                }, SYNC_CONFIG.scrollDebounce);
              }
            } else {
              // Remove highlighting from other paragraphs
              element.classList.remove('bg-primary/10');
              
              // If this was previously highlighted, reset reference
              if (lastHighlightedRef.current === paragraph.getKey()) {
                lastHighlightedRef.current = null;
              }
            }
          });
          
          // If no matching segment was found, clear last highlighted reference
          if (!foundMatch) {
            lastHighlightedRef.current = null;
          }
        } catch (error) {
          console.error('Error updating transcript highlighting:', error);
        }
      });
    };
    
    // Perform the update
    updateHighlighting();
    
  }, [currentTimeInSeconds, editor, segments]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearScrollTimeout();
    };
  }, []);
  
  return null;
}
