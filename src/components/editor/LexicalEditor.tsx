
import { useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { EditorToolbar } from "./EditorToolbar";
import { 
  $getRoot, 
  $createParagraphNode, 
  $createTextNode, 
  EditorState, 
  LexicalEditor as LexicalEditorType,
  ParagraphNode,
  LexicalNode,
  $getSelection
} from "lexical";
import { cn } from "@/lib/utils";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { Skeleton } from "@/components/ui/skeleton";

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

export function LexicalEditor({
  initialText,
  segments,
  className,
  readOnly = false,
  onEditorMount,
  onEditorChange,
  currentTimeInSeconds,
}: LexicalEditorProps) {
  const editorRef = useRef<LexicalEditorType | null>(null);
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
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
      console.error(error);
    },
    editable: !readOnly,
    nodes: [ListNode, ListItemNode],
  };

  // Highlight the paragraph that matches the current audio time
  useEffect(() => {
    if (!currentTimeInSeconds || !editorRef.current) return;
    
    editorRef.current.update(() => {
      const root = $getRoot();
      const paragraphs = root.getChildren();
      
      paragraphs.forEach((paragraph) => {
        const element = editorRef.current?.getElementByKey(paragraph.getKey());
        if (!element) return;
        
        // Check if this paragraph has timestamp data attributes
        const start = parseFloat(element.getAttribute('data-start') || '0');
        const end = parseFloat(element.getAttribute('data-end') || '0');
        
        if (start <= currentTimeInSeconds && currentTimeInSeconds <= end) {
          element.classList.add('bg-primary/10', 'transition-colors');
          
          // Scroll into view if needed
          const rect = element.getBoundingClientRect();
          const parentRect = element.parentElement?.getBoundingClientRect();
          
          if (parentRect && (rect.bottom > parentRect.bottom || rect.top < parentRect.top)) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          element.classList.remove('bg-primary/10');
        }
      });
    });
  }, [currentTimeInSeconds]);
  
  // Mount the editor and populate it with the initial text
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Store the editor reference for other components to use
    if (onEditorMount) {
      onEditorMount(editorRef.current);
    }
    
    setIsInitializing(true);
    
    // Populate the editor with initial content
    editorRef.current.update(() => {
      const root = $getRoot();
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
    
    // Force editor update and fix visibility after a small delay
    setTimeout(() => {
      if (editorRef.current) {
        // Force a repaint by reading the editor state
        editorRef.current.getEditorState().read(() => {
          // This ensures the editor state is processed
          const root = $getRoot();
          const hasContent = root.getChildrenSize() > 0;
          console.log("Editor content loaded:", hasContent);
        });
        
        // Apply a focus/blur cycle to ensure content renders
        // This mimics what happens when a user clicks
        editorRef.current.focus();
        
        // Mark content as loaded
        setIsContentLoaded(true);
        setIsInitializing(false);
      }
    }, 100);
    
  }, [initialText, segments, onEditorMount]);

  // Force update after editor and content are loaded
  useEffect(() => {
    if (isContentLoaded && editorRef.current) {
      editorRef.current.update(() => {
        // Force update to ensure content is visible
        const root = $getRoot();
        const paragraphs = root.getChildren();
        
        // Apply timestamp data attributes to DOM again for certainty
        paragraphs.forEach((paragraph: LexicalNode) => {
          if ((paragraph as any).timestampData) {
            const element = editorRef.current?.getElementByKey(paragraph.getKey());
            if (element) {
              element.setAttribute('data-start', (paragraph as any).timestampData.start);
              element.setAttribute('data-end', (paragraph as any).timestampData.end);
            }
          }
        });
      });
    }
  }, [isContentLoaded]);

  return (
    <div className={cn("border rounded-md", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <EditorToolbar />
        <div className="relative bg-muted/30 rounded-md">
          {isInitializing ? (
            <div className="min-h-[200px] max-h-[400px] p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-2" />
              <Skeleton className="h-4 w-4/5 mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 outline-none" />
              }
              placeholder={<div className="absolute top-[15px] left-[15px] text-muted-foreground">Start editing...</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          )}
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin
          onChange={(editorState, editor) => {
            editorRef.current = editor;
            if (onEditorChange) {
              onEditorChange(editorState);
            }
            
            // Apply timestamp data attributes to DOM
            editor.update(() => {
              const root = $getRoot();
              const paragraphs = root.getChildren();
              
              paragraphs.forEach((paragraph: LexicalNode) => {
                if ((paragraph as any).timestampData) {
                  const element = editor.getElementByKey(paragraph.getKey());
                  if (element) {
                    element.setAttribute('data-start', (paragraph as any).timestampData.start);
                    element.setAttribute('data-end', (paragraph as any).timestampData.end);
                  }
                }
              });
            });
          }}
        />
      </LexicalComposer>
    </div>
  );
}
