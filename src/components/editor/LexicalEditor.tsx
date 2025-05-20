
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
  onSegmentClick 
}: { 
  currentTimeInSeconds?: number | null;
  onSegmentClick?: (time: number) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const lastHighlightedRef = useRef<HTMLElement | null>(null);
  
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
    if (!currentTimeInSeconds || !editor) return;
    
    editor.update(() => {
      const root = $getRoot();
      const paragraphs = root.getChildren();
      let activeElementFound = false;
      
      paragraphs.forEach((paragraph) => {
        const element = editor.getElementByKey(paragraph.getKey());
        if (!element) return;
        
        // Check if this paragraph has timestamp data attributes
        const start = parseFloat(element.getAttribute('data-start') || '0');
        const end = parseFloat(element.getAttribute('data-end') || '0');
        
        if (start <= currentTimeInSeconds && currentTimeInSeconds <= end) {
          activeElementFound = true;
          
          // Only highlight and scroll if this is a new element
          if (lastHighlightedRef.current !== element) {
            // Remove highlight from previous element
            if (lastHighlightedRef.current) {
              lastHighlightedRef.current.classList.remove('bg-primary/10', 'active-segment');
            }
            
            // Add highlight to current element
            element.classList.add('bg-primary/10', 'active-segment', 'transition-colors');
            lastHighlightedRef.current = element;
            
            // Scroll into view if needed
            const editorContainer = editor.getRootElement()?.closest('.relative.bg-muted\\/30.rounded-md');
            if (!editorContainer) return;
            
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
        } else {
          // Only remove highlighting if this element was previously highlighted
          if (lastHighlightedRef.current === element) {
            element.classList.remove('bg-primary/10', 'active-segment');
            lastHighlightedRef.current = null;
          }
        }
      });
      
      // If no active element was found, clear the previous highlight
      if (!activeElementFound && lastHighlightedRef.current) {
        lastHighlightedRef.current.classList.remove('bg-primary/10', 'active-segment');
        lastHighlightedRef.current = null;
      }
    });
  }, [currentTimeInSeconds, editor]);
  
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
        
        {/* Handle timestamp highlighting */}
        {currentTimeInSeconds !== undefined && (
          <TimestampHighlighter 
            currentTimeInSeconds={currentTimeInSeconds}
            onSegmentClick={onSegmentClick} 
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
        
        /* Improve scrolling behavior */
        .transcript-content {
          scroll-behavior: smooth;
        }
        `}
      </style>
    </div>
  );
}
