
import { useCallback } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { toast } from "sonner";

interface TranscriptSegmentHandlerProps {
  onSegmentClick?: (time: number) => void;
}

export function TranscriptSegmentHandler({ onSegmentClick }: TranscriptSegmentHandlerProps) {
  const [editor] = useLexicalComposerContext();
  
  // Set up click handler for paragraphs with timestamps
  const setupClickHandlers = useCallback(() => {
    if (!editor || !onSegmentClick) return;
    
    editor.update(() => {
      try {
        // Get all paragraph elements
        const root = $getRoot();
        const paragraphs = root.getChildren();
        
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
                
                onSegmentClick(start);
                
                // Show visual feedback
                element.classList.add('bg-primary/20');
                setTimeout(() => {
                  element.classList.remove('bg-primary/20');
                }, 300);
              });
              
              // Mark as having a click handler
              element.setAttribute('data-has-click-handler', 'true');
            }
          }
        });
      } catch (error) {
        console.error('Error setting up transcript click handlers:', error);
      }
    });
  }, [editor, onSegmentClick]);
  
  // Set up click handlers when the component mounts
  // We use a callback effect to ensure handlers are setup after editor is ready
  return {
    setupClickHandlers
  };
}
