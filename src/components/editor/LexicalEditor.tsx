
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
  $getSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_CRITICAL
} from "lexical";
import { cn } from "@/lib/utils";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const [isContentPopulated, setIsContentPopulated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  const initAttempts = useRef(0);
  
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
      console.error("Lexical editor error:", error);
      toast.error("Editor error: " + error.message);
    },
    editable: !readOnly,
    nodes: [ListNode, ListItemNode],
  };

  // Cleanup function for timeouts
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    
    const registerTimeout = (callback: () => void, delay: number) => {
      const id = setTimeout(callback, delay);
      timeouts.push(id);
      return id;
    };
    
    return () => {
      timeouts.forEach(id => clearTimeout(id));
    };
  }, []);

  // Register listener for editor initialization - using onMount callback instead of INITIALIZED_COMMAND
  const registerEditorListener = (editor: LexicalEditorType) => {
    editorRef.current = editor;
    
    // Set the editor as mounted
    console.log("Editor instance created, setting as mounted");
    setIsEditorMounted(true);
    
    // Call onEditorMount callback if provided
    if (onEditorMount) {
      onEditorMount(editor);
    }
  };

  // Populate editor with content after initialization
  useEffect(() => {
    if (!editorRef.current || !isEditorMounted) {
      return;
    }

    console.log("Editor mounted, populating content now...");

    try {
      // Populate the editor with initial content
      editorRef.current.update(() => {
        const root = $getRoot();
        
        // Clear any existing content first
        root.clear();
        
        // Create segments from the initial text
        const textSegments = createTextSegments(initialText, segments);
        console.log(`Creating ${textSegments.length} text segments`);
        
        // Create paragraph nodes for each segment
        textSegments.forEach((segment) => {
          const paragraphNode = $createParagraphNode();
          
          // Add timestamp data if available
          if (segment.start !== undefined && segment.end !== undefined) {
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

      // Mark content as populated
      setIsContentPopulated(true);
      
      // Force a repaint after a short delay
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.update(() => {
            // This empty update forces a re-render
          });
          
          // Force visibility check
          setIsContentVisible(true);
          
          // Hide the loading state
          setIsInitializing(false);
        }
      }, 300);
    } catch (error) {
      console.error("Error populating editor:", error);
      // Even if there's an error, hide the loading state
      setIsInitializing(false);
    }
  }, [initialText, segments, isEditorMounted]);

  // Apply timestamp data attributes after content is populated
  useEffect(() => {
    if (!editorRef.current || !isContentPopulated) {
      return;
    }
    
    console.log("Content populated, applying timestamps...");
    
    try {
      editorRef.current.update(() => {
        const root = $getRoot();
        const paragraphs = root.getChildren();
        
        paragraphs.forEach((paragraph: LexicalNode) => {
          if ((paragraph as any).timestampData) {
            const element = editorRef.current?.getElementByKey(paragraph.getKey());
            if (element) {
              element.setAttribute('data-start', (paragraph as any).timestampData.start);
              element.setAttribute('data-end', (paragraph as any).timestampData.end);
              console.log(`Set timestamp data for paragraph: ${(paragraph as any).timestampData.start} - ${(paragraph as any).timestampData.end}`);
            }
          }
        });
      });
      
      // Force visibility check after timestamps are applied
      setTimeout(() => {
        const editorElement = document.querySelector('.LexicalEditor-root');
        if (editorElement) {
          console.log("Editor element found:", editorElement);
          const paragraphs = editorElement.querySelectorAll('p');
          console.log(`Found ${paragraphs.length} paragraphs in DOM`);

          // Final safeguard - force initialize to false even if other methods failed
          if (paragraphs.length > 0) {
            console.log("Content is visible in DOM, forcing initializing state to false");
            setIsInitializing(false);
            setIsContentVisible(true);
          }
        }
      }, 400);
    } catch (error) {
      console.error("Error applying timestamp attributes:", error);
    }
  }, [isContentPopulated]);

  // Handle highlighting based on current time
  useEffect(() => {
    if (!currentTimeInSeconds || !editorRef.current || !isContentPopulated) return;
    
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
  }, [currentTimeInSeconds, isContentPopulated]);

  // Fallback initialization in case the editor doesn't initialize properly
  useEffect(() => {
    if (isContentPopulated || !isEditorMounted || !editorRef.current) return;
    
    const retryInterval = setTimeout(() => {
      initAttempts.current += 1;
      console.log(`Retry attempt ${initAttempts.current} to populate content...`);
      
      if (initAttempts.current > 5) {
        console.log("Maximum retry attempts reached, forcing initialization complete");
        setIsInitializing(false);
        return;
      }
      
      // Try to force a re-render
      if (editorRef.current) {
        try {
          editorRef.current.update(() => {
            const root = $getRoot();
            if (root.getChildrenSize() === 0) {
              // Try to re-populate content if empty
              const textSegments = createTextSegments(initialText, segments);
              textSegments.forEach((segment) => {
                const paragraphNode = $createParagraphNode();
                const textNode = $createTextNode(segment.text);
                paragraphNode.append(textNode);
                root.append(paragraphNode);
              });
              console.log("Forced content population during retry");
            }
          });
          
          // Set content populated flag
          setIsContentPopulated(true);
          
          // Force-hide loading state after retry
          setTimeout(() => {
            setIsInitializing(false);
            setIsContentVisible(true);
          }, 300);
        } catch (error) {
          console.error("Error during retry:", error);
          setIsInitializing(false);
        }
      }
    }, 800);
    
    return () => clearTimeout(retryInterval);
  }, [isEditorMounted, isContentPopulated, initialText, segments]);

  // Force initialization to complete after maximum timeout
  useEffect(() => {
    const maxTimeout = setTimeout(() => {
      if (isInitializing) {
        console.log("Maximum wait time reached, forcing initialization complete");
        setIsInitializing(false);
      }
    }, 5000); // 5 second maximum waiting time
    
    return () => clearTimeout(maxTimeout);
  }, [isInitializing]);

  return (
    <div className={cn("border rounded-md", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="LexicalEditor-root">
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
                  <ContentEditable
                    className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 outline-none"
                  />
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
              if (!editorRef.current) {
                editorRef.current = editor;
                registerEditorListener(editor);
              }
              
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
        </div>
      </LexicalComposer>
    </div>
  );
}
