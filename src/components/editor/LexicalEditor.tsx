
import { useEffect, useRef, useState, useCallback } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode } from "@lexical/rich-text"; 
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
  $isRootNode
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
  onSegmentClick?: (segmentStart: number) => void;
  bufferTimeSeconds?: number;
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
                  element.classList.add('cursor-pointer', 'hover:bg-primary/5', 'transition-colors');
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
  bufferTimeSeconds = 5
}: { 
  currentTimeInSeconds?: number | null; 
  onSegmentClick?: (segmentStart: number) => void;
  bufferTimeSeconds?: number;
}) {
  const [editor] = useLexicalComposerContext();
  const lastHighlightedRef = useRef<HTMLElement | null>(null);
  
  // Setup click handlers for paragraphs
  useEffect(() => {
    if (!editor || !onSegmentClick) return;
    
    const handleClick = (event: MouseEvent) => {
      let target = event.target as HTMLElement;
      
      // Find the paragraph element that was clicked
      while (target && !target.hasAttribute('data-start') && target !== document.body) {
        target = target.parentElement as HTMLElement;
      }
      
      if (target && target.hasAttribute('data-start')) {
        const start = parseFloat(target.getAttribute('data-start') || '0');
        onSegmentClick(start);
        event.stopPropagation(); // Prevent multiple handlers
      }
    };
    
    // Add click handler to the editor
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
      
      return () => {
        editorElement.removeEventListener('click', handleClick);
      };
    }
  }, [editor, onSegmentClick]);
  
  // Handle highlighting based on current time
  useEffect(() => {
    if (!currentTimeInSeconds || !editor) return;
    
    editor.update(() => {
      const root = $getRoot();
      const paragraphs = root.getChildren();
      let activeElement: HTMLElement | null = null;
      
      paragraphs.forEach((paragraph) => {
        const element = editor.getElementByKey(paragraph.getKey());
        if (!element) return;
        
        // Check if this paragraph has timestamp data attributes
        const start = parseFloat(element.getAttribute('data-start') || '0');
        const end = parseFloat(element.getAttribute('data-end') || '0');
        
        // Add buffer time to the end timestamp
        const bufferedEnd = end + bufferTimeSeconds;
        
        if (start <= currentTimeInSeconds && currentTimeInSeconds <= bufferedEnd) {
          element.classList.add('bg-primary/10');
          activeElement = element;
          
          // Remove highlight from previous element if it's different
          if (lastHighlightedRef.current && lastHighlightedRef.current !== element) {
            lastHighlightedRef.current.classList.remove('bg-primary/10');
          }
          
          // Store current highlighted element
          lastHighlightedRef.current = element;
        } else if (element.classList.contains('bg-primary/10')) {
          // Only remove if it's not the active element
          if (!activeElement || activeElement !== element) {
            element.classList.remove('bg-primary/10');
          }
        }
      });
      
      // Scroll into view if needed
      if (activeElement) {
        const editorElement = editor.getRootElement();
        if (editorElement) {
          const rect = activeElement.getBoundingClientRect();
          const parentRect = editorElement.getBoundingClientRect();
          
          if (rect.bottom > parentRect.bottom || rect.top < parentRect.top) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    });
  }, [currentTimeInSeconds, editor, bufferTimeSeconds]);
  
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
  bufferTimeSeconds = 5,
}: LexicalEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const editorMountedRef = useRef(false);
  const uniqueNamespace = useRef(`TranscriptEditor-${Math.random().toString(36).substring(2, 11)}`).current;
  
  const initialConfig = {
    namespace: uniqueNamespace,
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
    nodes: [ListNode, ListItemNode, HeadingNode],
  };

  // Track editor mount state
  const handleEditorInitialized = useCallback((editor: LexicalEditorType) => {
    if (onEditorMount && !editorMountedRef.current) {
      onEditorMount(editor);
      editorMountedRef.current = true;
    }
  }, [onEditorMount]);

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
              <ContentEditable className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 outline-none" />
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
        <TimestampHighlighter 
          currentTimeInSeconds={currentTimeInSeconds} 
          onSegmentClick={onSegmentClick} 
          bufferTimeSeconds={bufferTimeSeconds}
        />
        
        <OnChangePlugin
          onChange={(editorState, editor) => {
            handleEditorInitialized(editor);
            
            if (onEditorChange) {
              onEditorChange(editorState);
            }
          }}
        />
      </LexicalComposer>
    </div>
  );
}
