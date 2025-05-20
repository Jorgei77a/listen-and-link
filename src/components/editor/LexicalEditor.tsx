import { useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { EditorToolbar } from "./EditorToolbar";
import { $getRoot, $createParagraphNode, $createTextNode, EditorState, LexicalEditor } from "lexical";
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
  onEditorMount?: (editor: LexicalEditor) => void;
  onEditorChange?: (editorState: EditorState) => void;
  currentTimeInSeconds?: number | null;
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
  const editorRef = useRef<LexicalEditor | null>(null);
  
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
          paragraphNode.setFormat("paragraph");
          paragraphNode.setAttribute("data-start", segment.start.toString());
          paragraphNode.setAttribute("data-end", segment.end.toString());
        }
        
        const textNode = $createTextNode(segment.text);
        paragraphNode.append(textNode);
        root.append(paragraphNode);
      });
    });
  }, [initialText, segments, onEditorMount]);

  return (
    <div className={cn("border rounded-md", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <EditorToolbar />
        <div className="relative bg-muted/30 rounded-md">
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
        <OnChangePlugin
          onChange={(editorState, editor) => {
            editorRef.current = editor;
            if (onEditorChange) {
              onEditorChange(editorState);
            }
          }}
        />
      </LexicalComposer>
    </div>
  );
}
