
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
  $isRootNode,
  TextNode
} from "lexical";
import { cn } from "@/lib/utils";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { TimestampPlugin } from "./plugins/TimestampPlugin";
import { AudioContextMenu } from "./AudioContextMenu";
import { TimestampedTextNode, $createTimestampedTextNode } from "./nodes/TimestampedTextNode";
import "./timestamp.css";
import { Toggle } from "@/components/ui/toggle";

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
  audioRef?: React.RefObject<HTMLAudioElement>;
  audioUrl?: string;
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
            // For segments with timestamps
            segments.forEach((segment) => {
              const paragraphNode = $createParagraphNode();
              
              // Split the segment text into words and create timestamped text nodes
              const words = segment.text.split(/\s+/);
              const wordCount = words.length;
              
              words.forEach((word, idx) => {
                // Calculate a proportional timestamp for each word
                // This is a simplification - in reality you'd want more accurate word-level timestamps
                const wordPosition = idx / wordCount;
                const wordTimestamp = segment.start + 
                  wordPosition * (segment.end - segment.start);
                
                // Create a timestamped text node for the word
                const textNode = $createTimestampedTextNode(word, wordTimestamp);
                paragraphNode.append(textNode);
                
                // Add space between words (except for the last word)
                if (idx < wordCount - 1) {
                  const spaceNode = $createTimestampedTextNode(" ", wordTimestamp);
                  paragraphNode.append(spaceNode);
                }
              });
              
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
  onEditorChange,
  currentTimeInSeconds,
  audioRef: externalAudioRef,
  audioUrl
}: LexicalEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const internalAudioRef = useRef<HTMLAudioElement>(null);
  const audioRef = externalAudioRef || internalAudioRef;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingMode, setEditingMode] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [contextMenuTimestamp, setContextMenuTimestamp] = useState<number | null>(null);
  
  // Create a stable audio element that won't be recreated
  useEffect(() => {
    // Only create an audio element if we're using the internal ref
    if (!externalAudioRef && audioUrl && internalAudioRef.current === null) {
      const audio = new Audio(audioUrl);
      internalAudioRef.current = audio;
      
      // Return cleanup function
      return () => {
        audio.pause();
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      };
    }
  }, [audioUrl, externalAudioRef]);
  
  // Update current time state from external time updates
  useEffect(() => {
    if (currentTimeInSeconds !== undefined && currentTimeInSeconds !== null) {
      setCurrentTime(currentTimeInSeconds);
    }
  }, [currentTimeInSeconds]);
  
  // Handle time updates from the audio element
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);
  
  // Handle context menu show
  const handleShowContextMenu = useCallback((x: number, y: number, hasTimestamp: boolean, timestamp: number | null) => {
    setContextMenuPosition({ x, y });
    setContextMenuTimestamp(timestamp);
    
    // For debugging
    console.log("Context menu opened at:", x, y, "Has timestamp:", hasTimestamp, "Timestamp:", timestamp);
  }, []);
  
  // Handle context menu close
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuPosition(null);
    setContextMenuTimestamp(null);
  }, []);
  
  // Handle play from timestamp context menu action
  const handlePlayFromTimestamp = useCallback(() => {
    if (audioRef.current && contextMenuTimestamp !== null) {
      console.log("Playing from timestamp:", contextMenuTimestamp);
      
      // Play from 1 second before the timestamp
      const targetTime = Math.max(0, contextMenuTimestamp - 1.0);
      audioRef.current.currentTime = targetTime;
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setIsPlaying(true);
    }
    handleCloseContextMenu();
  }, [audioRef, contextMenuTimestamp, handleCloseContextMenu]);
  
  // Handle play 5 seconds earlier action
  const handlePlayEarlier = useCallback(() => {
    if (audioRef.current && contextMenuTimestamp !== null) {
      console.log("Playing from 5s earlier:", contextMenuTimestamp - 5);
      
      // Play from 6 seconds before the timestamp (1s lead-in + 5s earlier)
      const targetTime = Math.max(0, contextMenuTimestamp - 6.0);
      audioRef.current.currentTime = targetTime;
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setIsPlaying(true);
    }
    handleCloseContextMenu();
  }, [audioRef, contextMenuTimestamp, handleCloseContextMenu]);
  
  // Handle pause action
  const handlePause = useCallback(() => {
    if (audioRef.current) {
      console.log("Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
    }
    handleCloseContextMenu();
  }, [audioRef, handleCloseContextMenu]);
  
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
          TimestampedTextNode,
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
          
          {/* Context menu for right-click */}
          <AudioContextMenu
            position={contextMenuPosition}
            onClose={handleCloseContextMenu}
            hasTimestamp={contextMenuTimestamp !== null}
            isPlaying={isPlaying}
            onPlayFromHere={handlePlayFromTimestamp}
            onPlayEarlier={handlePlayEarlier}
            onPause={handlePause}
          >
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
          </AudioContextMenu>
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
        
        {/* Add our timestamp plugin */}
        <TimestampPlugin
          audioRef={audioRef}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          currentTime={currentTime}
          editingMode={true} // Always enable timestamp features regardless of mode
          onContextMenu={handleShowContextMenu}
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
      
      {/* Audio player (hidden if external ref is provided) */}
      {!externalAudioRef && audioUrl && (
        <div className="mt-4">
          <audio ref={audioRef} src={audioUrl} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
}
