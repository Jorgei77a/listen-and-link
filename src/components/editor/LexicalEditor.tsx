
import { useEffect, useRef, useState } from "react";
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
  $isRootNode,
  TextNode
} from "lexical";
import { cn } from "@/lib/utils";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import "./timestamp.css";

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
          if (segments && segments.length > 0) {
            // For segments with timestamps (now just regular paragraphs)
            segments.forEach((segment) => {
              const paragraphNode = $createParagraphNode();
              const textNode = $createTextNode(segment.text);
              paragraphNode.append(textNode);
              root.append(paragraphNode);
            });
          } else {
            // Fallback for no segments - just use the full text as regular paragraph
            const paragraphNode = $createParagraphNode();
            const textNode = $createTextNode(initialText);
            paragraphNode.append(textNode);
            root.append(paragraphNode);
          }
        });
        
        // Mark as initialized and notify parent
        setIsInitialized(true);
        if (onReady) onReady();
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
  onEditorChange
}: LexicalEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  
  return (
    <div className={cn("border rounded-md", className)} ref={editorContainerRef}>
      <LexicalComposer initialConfig={{
        namespace: "TranscriptEditor",
        theme: {
          paragraph: "mb-2 last:mb-0",
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
        nodes: [
          ListNode, 
          ListItemNode, 
          HeadingNode,
          TextNode,
        ],
      }}>
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <EditorToolbar />
        </div>
        
        <div className={cn("relative bg-muted/30 rounded-md")}>
          {!isContentReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10 rounded-md">
              <div className="animate-pulse bg-muted rounded-md w-full h-[200px] opacity-30"></div>
            </div>
          )}
          
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 outline-none" />
            }
            placeholder={
              <div className="absolute top-[15px] left-[15px] text-muted-foreground">
                Start editing...
              </div>
            }
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
