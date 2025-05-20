
import React, { useEffect, useRef, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { $getRoot, $createParagraphNode, $createTextNode, LexicalEditor } from "lexical";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode } from "@lexical/rich-text";
import { EditorToolbar } from "./EditorToolbar";
import { InlineEditorToolbar } from "./InlineEditorToolbar";
import { 
  findActiveSegment, 
  scrollElementIntoView, 
  isSameSegment,
  type TranscriptSegment 
} from "@/utils/transcriptSyncUtils";

interface EditableInteractiveTranscriptProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSegmentClick: (segment: TranscriptSegment) => void;
  isPlaying?: boolean;
  className?: string;
  onEditorMount?: (editor: LexicalEditor) => void;
}

function SegmentEditor({
  segment,
  isActive,
  onClick,
}: {
  segment: TranscriptSegment;
  isActive: boolean;
  onClick: () => void;
}) {
  const editorRef = useRef<LexicalEditor | null>(null);
  
  // Use a unique namespace for each segment editor to avoid conflicts
  const namespace = `segment-editor-${segment.start.toString().replace('.', '-')}`;
  
  const initialConfig = {
    namespace,
    theme: {
      paragraph: "mb-0",
      text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
      },
    },
    onError: (error: Error) => {
      console.error(`Segment Editor Error (${segment.start}):`, error);
    },
    editable: true,
    nodes: [ListNode, ListItemNode, HeadingNode],
  };

  return (
    <div 
      className={`p-2 rounded transition-colors cursor-pointer ${
        isActive ? 'bg-primary/10 border-l-4 border-primary pl-3' : 'hover:bg-muted/50'
      }`}
      onClick={onClick}
      title={`Start: ${formatTime(segment.start)}`}
      data-start={segment.start}
      data-end={segment.end}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable 
              className="outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1" 
              onClick={(e) => e.stopPropagation()} // Prevent triggering parent onClick
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin
          onChange={(editorState, editor) => {
            if (!editorRef.current && editor) {
              editorRef.current = editor;
              
              // Initialize content once the editor is available
              editor.update(() => {
                const root = $getRoot();
                root.clear();
                const paragraph = $createParagraphNode();
                const textNode = $createTextNode(segment.text);
                paragraph.append(textNode);
                root.append(paragraph);
              });
            }
          }}
        />
      </LexicalComposer>
    </div>
  );
}

export function EditableInteractiveTranscript({
  segments,
  currentTime,
  onSegmentClick,
  isPlaying = false,
  className,
  onEditorMount
}: EditableInteractiveTranscriptProps) {
  const [activeSegment, setActiveSegment] = useState<TranscriptSegment | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastClickTimeRef = useRef<number>(0);
  const shouldScrollRef = useRef<boolean>(true);

  // Find and set the active segment based on current time
  useEffect(() => {
    const newActiveSegment = findActiveSegment(currentTime, segments);
    
    if (!isSameSegment(newActiveSegment, activeSegment)) {
      setActiveSegment(newActiveSegment);
      
      // Enable auto-scrolling only when playing or when the time changes significantly
      if (isPlaying || Math.abs((activeSegment?.start || 0) - (newActiveSegment?.start || 0)) > 5) {
        shouldScrollRef.current = true;
      }
    }
  }, [currentTime, segments, activeSegment, isPlaying]);

  // Scroll the active segment into view when it changes
  useEffect(() => {
    if (activeSegment && shouldScrollRef.current && containerRef.current) {
      const activeElement = containerRef.current.querySelector(`[data-start="${activeSegment.start}"]`);
      
      // Only scroll if we haven't clicked recently (to avoid fighting with user scrolling)
      const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
      if (timeSinceLastClick > 1000 && isPlaying) { // Only auto-scroll when playing
        scrollElementIntoView(activeElement as HTMLElement);
      }
    }
  }, [activeSegment, isPlaying]);

  // Temporarily disable auto-scrolling when user interacts
  const handleUserScroll = useCallback(() => {
    shouldScrollRef.current = false;
    
    // Re-enable auto-scrolling after some time without user interaction
    setTimeout(() => {
      shouldScrollRef.current = isPlaying; // Only re-enable if still playing
    }, 5000);
  }, [isPlaying]);

  // Handle segment click with debounce to prevent double-processing
  const handleSegmentClick = useCallback((segment: TranscriptSegment) => {
    // Update last click time
    lastClickTimeRef.current = Date.now();
    
    // Disable auto-scrolling temporarily after a user click
    shouldScrollRef.current = false;
    
    // Call the parent handler
    onSegmentClick(segment);
  }, [onSegmentClick]);
  
  return (
    <div className={`relative ${className || ""}`}>      
      <ScrollArea 
        className={className || "h-[400px]"} 
        onWheel={handleUserScroll} 
        onTouchMove={handleUserScroll}
      >
        <div className="space-y-2 p-4" ref={containerRef}>
          {segments.map((segment) => {
            const isActive = activeSegment?.start === segment.start;
            
            return (
              <SegmentEditor
                key={`segment-${segment.start}`}
                segment={segment}
                isActive={isActive}
                onClick={() => handleSegmentClick(segment)}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper function to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
