
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
import { TimestampHighlighter } from "./TimestampHighlighter";
import { TranscriptSegmentHandler } from "./TranscriptSegmentHandler";
import { normalizeSegments, TranscriptSegment as AudioSegment } from "@/utils/audioSyncUtils";

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
  onJumpToTime?: (time: number) => void;
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
          
          // Normalize segments to ensure consistent boundaries
          const normalizedSegments = segments 
            ? normalizeSegments(segments as AudioSegment[])
            : undefined;
          
          // Split the text into segments
          const textSegments = createTextSegments(initialText, normalizedSegments);
          
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
                }
              }
            });
          });
          
          // Finally set as initialized and notify parent
          setIsInitialized(true);
          if (onReady) onReady();
        }, 100);
      } catch (error) {
        console.error("Error initializing Lexical editor content:", error);
        setIsInitialized(true); // Mark as initialized even on error to prevent retries
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [editor, initialText, segments, isInitialized, onReady]);
  
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
  onJumpToTime
}: LexicalEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const [normalizedSegments, setNormalizedSegments] = useState<AudioSegment[]>([]);
  
  // Create normalized segments once from the original segments
  useEffect(() => {
    if (segments) {
      setNormalizedSegments(normalizeSegments(segments as AudioSegment[]));
    }
  }, [segments]);
  
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
    nodes: [ListNode, ListItemNode, HeadingNode],
  };

  // Custom plugin to set up click handlers after editor is ready
  function SegmentClickPlugin() {
    const [editor] = useLexicalComposerContext();
    const { setupClickHandlers } = TranscriptSegmentHandler({
      onSegmentClick: onJumpToTime
    });
    
    useEffect(() => {
      // Set timeout to ensure editor is fully initialized
      const timerId = setTimeout(() => {
        if (isContentReady && editor) {
          setupClickHandlers();
        }
      }, 200);
      
      return () => clearTimeout(timerId);
    }, [editor, isContentReady]);
    
    return null;
  }

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
        
        {/* Handle timestamp highlighting based on current time */}
        {currentTimeInSeconds !== undefined && normalizedSegments.length > 0 && (
          <TimestampHighlighter 
            currentTimeInSeconds={currentTimeInSeconds} 
            segments={normalizedSegments}
          />
        )}
        
        {/* Add click handling for segments */}
        {onJumpToTime && <SegmentClickPlugin />}
        
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
    </div>
  );
}
