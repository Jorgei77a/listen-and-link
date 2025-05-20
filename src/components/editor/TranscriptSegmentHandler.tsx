
import { useCallback, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { toast } from "sonner";
import { SYNC_CONFIG } from "@/utils/audioSyncUtils";

interface TranscriptSegmentHandlerProps {
  onSegmentClick?: (time: number) => void;
}

export function TranscriptSegmentHandler({ onSegmentClick }: TranscriptSegmentHandlerProps) {
  const [editor] = useLexicalComposerContext();
  const clickHandlersSetupRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const lastClickPositionRef = useRef(-1);
  
  // Set up click handler for paragraphs with timestamps
  const setupClickHandlers = useCallback(() => {
    if (!editor || !onSegmentClick) return;
    
    editor.update(() => {
      try {
        // Get all paragraph elements
        const root = $getRoot();
        const paragraphs = root.getChildren();
        
        // Track if we actually set up any handlers
        let handlersAdded = false;
        
        // Attach click handlers to each paragraph
        paragraphs.forEach(paragraph => {
          const element = editor.getElementByKey(paragraph.getKey());
          if (!element) return;
          
          // Get time data from attributes
          const start = parseFloat(element.getAttribute('data-start') || '-1');
          
          // Only add click handler if we have valid time data
          if (start >= 0) {
            // Make it visibly clickable
            element.classList.add('cursor-pointer', 'hover:bg-muted/50', 'transition-colors');
            
            // Add click handler if it doesn't already have one
            if (!element.hasAttribute('data-has-click-handler')) {
              element.addEventListener('click', (e) => {
                // Don't trigger if the user is selecting text
                if (window.getSelection()?.toString()) return;
                
                // Prevent double-clicks or rapid clicks (debounce)
                const now = Date.now();
                if (now - lastClickTimeRef.current < 500 && start === lastClickPositionRef.current) {
                  console.log("Ignoring rapid repeated click on same segment");
                  return;
                }
                
                // Update our tracking refs
                lastClickTimeRef.current = now;
                lastClickPositionRef.current = start;
                
                console.log(`Segment clicked with time: ${start}s`);
                
                // Call the callback with the start time
                if (onSegmentClick) {
                  // Prevent event bubbling that might cause additional issues
                  e.stopPropagation();
                  
                  // Add a small delay to ensure proper event handling
                  setTimeout(() => {
                    onSegmentClick(start);
                  }, 50);
                }
                
                // Show visual feedback
                element.classList.add('bg-primary/20');
                setTimeout(() => {
                  element.classList.remove('bg-primary/20');
                }, 300);
              });
              
              // Mark as having a click handler
              element.setAttribute('data-has-click-handler', 'true');
              handlersAdded = true;
            }
          }
        });
        
        // Update our ref if we added handlers
        if (handlersAdded) {
          clickHandlersSetupRef.current = true;
        }
      } catch (error) {
        console.error('Error setting up transcript click handlers:', error);
      }
    });
  }, [editor, onSegmentClick]);
  
  // Effect to set up click handlers when the editor is ready
  useEffect(() => {
    // Only set up handlers if the editor and callback are available
    if (editor && onSegmentClick && !clickHandlersSetupRef.current) {
      // Wait for the editor to be ready
      const timeout = setTimeout(() => {
        setupClickHandlers();
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [editor, onSegmentClick, setupClickHandlers]);
  
  // Expose method to manually set up click handlers
  const refreshClickHandlers = useCallback(() => {
    clickHandlersSetupRef.current = false;
    setupClickHandlers();
  }, [setupClickHandlers]);
  
  return {
    setupClickHandlers,
    refreshClickHandlers
  };
}
