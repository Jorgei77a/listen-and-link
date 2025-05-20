
import { useEffect, useRef, useState, useCallback } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode } from "@lexical/rich-text"; // Add import for HeadingNode
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { EditorToolbar } from "./EditorToolbar";
import { 
  $getRoot, 
  $createParagraphNode, 
  $createTextNode, 
  EditorState, 
  LexicalEditor as LexicalEditorType,
  ParagraphNode,
  LexicalNode,
  $isRootNode,
  $getNodeByKey
} from "lexical";
import { cn } from "@/lib/utils";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { DEFAULT_SEGMENT_BUFFERS, isTimeInSegment, findActiveSegment } from "@/utils/audioUtils";

interface LexicalEditorProps {
  initialText: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  className?: string;
  readOnly?: boolean;
  onEditorMount?: (editor: LexicalEditorType) => void;
  onEditorChange?: (editorState: EditorState) => void;
  currentTimeInSeconds?: number | null;
  onSegmentClick?: (time: number) => void;
  bufferSettings?: {
    segmentEndBuffer: number;
    segmentLookaheadBuffer: number;
    debugMode?: boolean;
  };
}

// Create a custom interface to handle our timestamps
interface TimestampData {
  start: string;
  end: string;
}

// Add a type declaration for our extended ParagraphNode
declare module 'lexical' {
  interface ParagraphNode {
    timestampData?: TimestampData;
  }
  
  interface LexicalNode {
    timestampData?: TimestampData;
  }
}

function createTextSegments(text: string, segments?: LexicalEditorProps['segments']): Array<{ text: string; start?: number; end?: number }> {
  // If we have segments with timestamps, use them
  if (segments && segments.length > 0) {
    return segments.map(segment => ({
      text: segment.text,
      start: segment.start,
      end: segment.end,
    }));
  }
  
  // Otherwise, split by sentences (simple implementation)
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map(sentence => ({ text: sentence.trim() }));
}

// This component initializes content after the editor has mounted
function InitializeContent({
  initialText,
  segments,
  onReady
}: {
  initialText: string;
  segments?: LexicalEditorProps['segments'];
  onReady?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (isInitialized) return;
    
    // Small delay to ensure the editor is fully mounted
    const timer = setTimeout(() => {
      if (!editor) return;
      
      try {
        editor.update(() => {
          const root = $getRoot();
          if (!$isRootNode(root)) return;
          
          // Clear any existing content
          root.clear();
          
          // Split the text into segments
          const textSegments = createTextSegments(initialText, segments);
          
          // Create paragraph nodes for each segment
          textSegments.forEach((segment) => {
            const paragraphNode = $createParagraphNode();
            
            // Add timestamp data if available
            if (segment.start !== undefined && segment.end !== undefined) {
              // Store timestamp data on the node using a custom property
              (paragraphNode as ParagraphNode).timestampData = {
                start: segment.start.toString(),
                end: segment.end.toString()
              };
            }
            
            const textNode = $createTextNode(segment.text);
            paragraphNode.append(textNode);
            root.append(paragraphNode);
          });
        });
        
        // Apply timestamp attributes to DOM
        setTimeout(() => {
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const paragraphs = root.getChildren();
            
            paragraphs.forEach((paragraph) => {
              const timestampData = (paragraph as any).timestampData;
              if (timestampData) {
                const element = editor.getElementByKey(paragraph.getKey());
                if (element) {
                  element.setAttribute('data-start', timestampData.start);
                  element.setAttribute('data-end', timestampData.end);
                  // Add a visual indicator and pointer cursor to show clickable areas
                  element.classList.add('has-timestamp');
                }
              }
            });
          });
          
          // Finally set as initialized and notify parent
          setIsInitialized(true);
          if (onReady) onReady();
        }, 50);
      } catch (error) {
        console.error("Error initializing Lexical editor content:", error);
        setIsInitialized(true); // Mark as initialized even on error to prevent retries
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [editor, initialText, segments, isInitialized, onReady]);
  
  return null;
}

// Component to handle timestamp highlighting based on current audio time
function TimestampHighlighter({ 
  currentTimeInSeconds, 
  onSegmentClick,
  bufferSettings
}: { 
  currentTimeInSeconds?: number | null;
  onSegmentClick?: (time: number) => void;
  bufferSettings?: LexicalEditorProps['bufferSettings'];
}) {
  const [editor] = useLexicalComposerContext();
  const lastHighlightedRef = useRef<HTMLElement | null>(null);
  const nextSegmentRef = useRef<HTMLElement | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use default buffer settings if none provided
  const buffers = bufferSettings || DEFAULT_SEGMENT_BUFFERS;
  
  useEffect(() => {
    if (!editor) return;
    
    // Set up click handlers on paragraphs with timestamps
    const setupClickHandlers = () => {
      const editorElement = editor.getRootElement();
      if (!editorElement) return;
      
      // Find all paragraphs with timestamp data
      const paragraphsWithTimestamps = editorElement.querySelectorAll('[data-start]');
      
      paragraphsWithTimestamps.forEach((paragraph) => {
        // Only add click handler if we have a callback and haven't already set it up
        if (onSegmentClick && !paragraph.hasAttribute('data-click-handler-added')) {
          paragraph.addEventListener('click', () => {
            const startTime = parseFloat(paragraph.getAttribute('data-start') || '0');
            if (onSegmentClick) {
              onSegmentClick(startTime);
            }
          });
          
          // Mark as having click handler to avoid duplicates
          paragraph.setAttribute('data-click-handler-added', 'true');
        }
      });
    };
    
    // Initial setup
    setupClickHandlers();
    
    // Setup observer to handle dynamically added content
    const observer = new MutationObserver(() => {
      setupClickHandlers();
    });
    
    const editorElement = editor.getRootElement();
    if (editorElement) {
      observer.observe(editorElement, { 
        childList: true, 
        subtree: true 
      });
    }
    
    return () => {
      observer.disconnect();
    };
  }, [editor, onSegmentClick]);

  useEffect(() => {
    // Clear any existing timeout to prevent race conditions
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    
    if (!currentTimeInSeconds || !editor) return;
    
    // Avoid processing if the time hasn't changed significantly
    if (lastTimeRef.current !== null && 
        Math.abs((lastTimeRef.current || 0) - currentTimeInSeconds) < 0.05) {
      return;
    }
    
    lastTimeRef.current = currentTimeInSeconds;
    
    // Use a small timeout to debounce rapid changes and prevent UI jank
    highlightTimeoutRef.current = setTimeout(() => {
      // This is a pure UI update and should NOT modify audio playback
      editor.update(() => {
        const root = $getRoot();
        const paragraphs = root.getChildren();
        let activeElementFound = false;
        
        // Build an array of segment timestamps for finding active segment
        const segments = paragraphs.map((paragraph) => {
          const element = editor.getElementByKey(paragraph.getKey());
          if (!element) return null;
          
          const start = parseFloat(element.getAttribute('data-start') || '0');
          const end = parseFloat(element.getAttribute('data-end') || '0');
          
          return { element, start, end };
        }).filter(Boolean) as Array<{ element: HTMLElement, start: number, end: number }>;
        
        // Clear any previous highlights
        if (lastHighlightedRef.current) {
          lastHighlightedRef.current.classList.remove('bg-primary/10', 'active-segment');
          
          // Remove buffer visual indicators if debug mode
          if (buffers.debugMode) {
            lastHighlightedRef.current.classList.remove('buffer-active');
            
            // Remove debug elements if they exist
            const debugEl = lastHighlightedRef.current.querySelector('.buffer-debug-indicator');
            if (debugEl) debugEl.remove();
          }
        }
        
        if (nextSegmentRef.current) {
          nextSegmentRef.current.classList.remove('next-segment-lookahead');
        }
        
        // Find the segments - UI HIGHLIGHTING ONLY, not affecting playback
        for (let i = 0; i < segments.length; i++) {
          const { element, start, end } = segments[i];
          
          // Check if this segment should be active using isTimeInSegment helper
          if (isTimeInSegment(currentTimeInSeconds, start, end, buffers.segmentEndBuffer)) {
            activeElementFound = true;
            
            // Add highlight to current element
            element.classList.add('bg-primary/10', 'active-segment', 'transition-colors');
            lastHighlightedRef.current = element;
            
            // Add buffer visual indicator if in debug mode
            if (buffers.debugMode && currentTimeInSeconds > end) {
              element.classList.add('buffer-active');
              
              // Add a small debug indicator showing how many buffer seconds are remaining
              const remainingBuffer = (end + buffers.segmentEndBuffer) - currentTimeInSeconds;
              let debugEl = element.querySelector('.buffer-debug-indicator');
              
              if (!debugEl) {
                debugEl = document.createElement('span');
                debugEl.className = 'buffer-debug-indicator';
                element.appendChild(debugEl);
              }
              
              (debugEl as HTMLElement).textContent = `+${remainingBuffer.toFixed(1)}s`;
            }
            
            // Scroll into view if needed, but don't scroll if user is manually scrolling
            if (document.activeElement !== element.closest('.transcript-content')) {
              const editorContainer = editor.getRootElement()?.closest('.relative.bg-muted\\/30.rounded-md');
              if (!editorContainer) break;
              
              const containerRect = editorContainer.getBoundingClientRect();
              const elementRect = element.getBoundingClientRect();
              
              // Check if element is outside the visible area of the container
              const isOutOfView = 
                elementRect.top < containerRect.top || 
                elementRect.bottom > containerRect.bottom;
              
              if (isOutOfView) {
                // Use smooth scrolling to avoid jarring transitions
                element.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center'
                });
              }
            }
            
            // Check if we should also highlight the next segment (lookahead)
            const nextSegment = segments[i + 1];
            if (nextSegment && 
                currentTimeInSeconds >= (nextSegment.start - buffers.segmentLookaheadBuffer) && 
                currentTimeInSeconds < nextSegment.start) {
              // Apply a softer highlight to the next segment
              nextSegment.element.classList.add('next-segment-lookahead');
              nextSegmentRef.current = nextSegment.element;
            }
            
            break;
          }
        }
        
        // If no segment is active based on direct matching and we're near the end of segments,
        // check if we're within lookahead range of the first segment (for looping playback)
        if (!activeElementFound && segments.length > 0 && currentTimeInSeconds < segments[0].start) {
          const firstSegment = segments[0];
          if (currentTimeInSeconds >= (firstSegment.start - buffers.segmentLookaheadBuffer)) {
            firstSegment.element.classList.add('next-segment-lookahead');
            nextSegmentRef.current = firstSegment.element;
          }
        }
      });
    }, 50); // Small debounce timeout
    
    return () => {
      // Clean up timeout on unmount or before next update
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [currentTimeInSeconds, editor, buffers]);
  
  return null;
}

// Custom plugin for handling paragraph clicks
function ClickableTimestampsPlugin({ onSegmentClick }: { onSegmentClick?: (time: number) => void }) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    if (!editor || !onSegmentClick) return;
    
    // Handle click events on the editor
    const rootElement = editor.getRootElement();
    if (!rootElement) return;
    
    const handleClick = (e: MouseEvent) => {
      // Find the paragraph element that was clicked
      let target = e.target as HTMLElement | null;
      let paragraphElement: HTMLElement | null = null;
      
      // Walk up the DOM tree to find the paragraph
      while (target && target !== rootElement) {
        if (target.hasAttribute('data-start')) {
          paragraphElement = target;
          break;
        }
        target = target.parentElement;
      }
      
      // If we found a paragraph with timestamp data, trigger the callback
      if (paragraphElement) {
        const startTime = parseFloat(paragraphElement.getAttribute('data-start') || '0');
        onSegmentClick(startTime);
      }
    };
    
    rootElement.addEventListener('click', handleClick);
    
    return () => {
      rootElement.removeEventListener('click', handleClick);
    };
  }, [editor, onSegmentClick]);
  
  return null;
}

export function LexicalEditor({
  initialText,
  segments,
  className,
  readOnly = false,
  onEditorMount,
  onEditorChange,
  currentTimeInSeconds,
  onSegmentClick,
  bufferSettings = DEFAULT_SEGMENT_BUFFERS,
}: LexicalEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  
  const initialConfig = {
    namespace: "TranscriptEditor",
    theme: {
      paragraph: "mb-2 last:mb-0",
      heading: {
        h1: "text-2xl font-bold mb-2",
        h2: "text-xl font-bold mb-2",
        h3: "text-lg font-bold mb-2",
      },
      list: {
        ul: "list-disc ml-6 mb-2",
        ol: "list-decimal ml-6 mb-2",
      },
      text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
        highlight: "bg-yellow-200",
      },
    },
    onError: (error: Error) => {
      console.error("Lexical Editor Error:", error);
    },
    editable: !readOnly,
    nodes: [ListNode, ListItemNode, HeadingNode], // Add HeadingNode to the nodes array
  };

  return (
    <div className={cn("border rounded-md", className)} ref={editorContainerRef}>
      <LexicalComposer initialConfig={initialConfig}>
        <EditorToolbar />
        <div className="relative bg-muted/30 rounded-md">
          {!isContentReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10 rounded-md">
              <div className="animate-pulse bg-muted rounded-md w-full h-[200px] opacity-30"></div>
            </div>
          )}
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 outline-none transcript-content" />
            }
            placeholder={<div className="absolute top-[15px] left-[15px] text-muted-foreground">Start editing...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        
        {/* Initialize content after editor is mounted */}
        <InitializeContent 
          initialText={initialText} 
          segments={segments} 
          onReady={() => {
            setIsContentReady(true);
          }}
        />
        
        {/* Handle timestamp highlighting with buffer settings */}
        {currentTimeInSeconds !== undefined && (
          <TimestampHighlighter 
            currentTimeInSeconds={currentTimeInSeconds}
            onSegmentClick={onSegmentClick}
            bufferSettings={bufferSettings}
          />
        )}
        
        {/* Add clickable timestamps plugin */}
        {onSegmentClick && (
          <ClickableTimestampsPlugin onSegmentClick={onSegmentClick} />
        )}
        
        <OnChangePlugin
          onChange={(editorState, editor) => {
            if (onEditorMount && editor) {
              onEditorMount(editor);
            }
            
            if (onEditorChange) {
              onEditorChange(editorState);
            }
          }}
        />
      </LexicalComposer>

      <style>
        {`
        /* Add styling for timestamps */
        .has-timestamp {
          cursor: pointer;
          position: relative;
          border-left: 2px solid transparent;
          padding-left: 4px;
        }
        
        .has-timestamp:hover {
          background-color: rgba(0,0,0,0.05);
          border-left-color: var(--primary);
        }
        
        .active-segment {
          border-left: 2px solid var(--primary) !important;
          background-color: rgba(var(--primary), 0.1) !important;
        }
        
        /* Add styling for next segment lookahead */
        .next-segment-lookahead {
          border-left: 2px dashed var(--primary) !important;
          background-color: rgba(var(--primary), 0.05) !important;
        }
        
        /* Add styling for buffer indicators in debug mode */
        .buffer-active {
          position: relative;
          border-bottom: 1px dashed var(--primary);
        }
        
        .buffer-debug-indicator {
          position: absolute;
          right: 4px;
          bottom: 4px;
          font-size: 10px;
          background-color: var(--primary);
          color: white;
          border-radius: 4px;
          padding: 1px 3px;
          opacity: 0.8;
        }
        
        /* Improve scrolling behavior */
        .transcript-content {
          scroll-behavior: smooth;
        }
        `}
      </style>
    </div>
  );
}
