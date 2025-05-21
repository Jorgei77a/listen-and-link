
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useState, useRef } from "react";
import { 
  $getNodeByKey,
  $getSelection, 
  $isRangeSelection, 
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
  $isTextNode,
  NodeKey
} from "lexical";
import { $isTimestampedTextNode } from "../nodes/TimestampedTextNode";
import { MiniPlayerBubble } from "../MiniPlayerBubble";
import { mergeRegister } from "@lexical/utils";

export const PLAY_AUDIO_FROM_TIMESTAMP_COMMAND: LexicalCommand<{
  nodeKey: NodeKey;
  offset?: number;
}> = createCommand('PLAY_AUDIO_FROM_TIMESTAMP_COMMAND');

interface TimestampPluginProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  currentTime: number;
  leadInOffset?: number;
  editingMode: boolean;
  onContextMenu?: (x: number, y: number, hasTimestamp: boolean, timestamp: number | null) => void;
}

export function TimestampPlugin({
  audioRef,
  isPlaying,
  setIsPlaying,
  currentTime,
  leadInOffset = 1.0,
  editingMode,
  onContextMenu
}: TimestampPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });
  const lastClickedTimestamp = useRef<number | null>(null);
  // Add ref to track if a long press is in progress
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{x: number, y: number} | null>(null);

  const playFromTimestamp = useCallback((timestamp: number, offset: number = 0) => {
    if (audioRef.current && timestamp !== null) {
      const targetTime = Math.max(0, timestamp - leadInOffset + offset);
      audioRef.current.currentTime = targetTime;
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setIsPlaying(true);
      lastClickedTimestamp.current = timestamp;
      
      // Position the bubble near the cursor
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position bubble below the cursor
        setBubblePosition({ 
          x: rect.left, 
          y: rect.bottom + 10 
        });
        setShowBubble(true);
      }
    }
  }, [audioRef, leadInOffset, setIsPlaying]);
  
  const handlePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(err => console.error("Audio playback error:", err));
        setIsPlaying(true);
      }
    }
  }, [audioRef, isPlaying, setIsPlaying]);
  
  const handleBubbleDragEnd = (position: { x: number, y: number }) => {
    setBubblePosition(position);
  };

  // Register command to play audio from timestamp
  useEffect(() => {
    return editor.registerCommand<{
      nodeKey: NodeKey;
      offset?: number;
    }>(
      PLAY_AUDIO_FROM_TIMESTAMP_COMMAND,
      ({ nodeKey, offset = 0 }) => {
        editor.getEditorState().read(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isTimestampedTextNode(node)) {
            const timestamp = node.getTimestamp();
            if (timestamp !== undefined) {
              playFromTimestamp(timestamp, offset);
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor, playFromTimestamp]);
  
  // Handle ctrl/alt + click for quick preview
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Check if ctrl key (Windows/Linux) or alt/option key (macOS) is pressed
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
        
        // Let editor process this click first to update selection
        setTimeout(() => {
          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && selection.anchor.type === 'text') {
              const node = selection.anchor.getNode();
              
              if ($isTimestampedTextNode(node)) {
                const timestamp = node.getTimestamp();
                if (timestamp !== undefined) {
                  playFromTimestamp(timestamp);
                }
              }
            }
          });
        }, 0);
      }
    };
    
    // Find the timestamp in a node
    const getTimestampFromElement = (element: HTMLElement): number | null => {
      // First check if the element itself has a timestamp attribute
      if (element.hasAttribute('data-timestamp')) {
        return parseFloat(element.getAttribute('data-timestamp') || '0');
      }
      
      // Then check if any parent element has a timestamp attribute
      const timestampEl = element.closest('[data-timestamp]');
      if (timestampEl) {
        return parseFloat(timestampEl.getAttribute('data-timestamp') || '0');
      }
      
      return null;
    };
    
    // Improved context menu handler
    const handleContextMenu = (e: MouseEvent) => {
      if (!onContextMenu) return;
      
      e.preventDefault(); // Prevent default browser context menu
      
      // Find the timestamp at the clicked position
      let timestamp: number | null = null;
      let hasTimestamp = false;
      
      // Get the element that was clicked
      const target = e.target as HTMLElement;
      
      timestamp = getTimestampFromElement(target);
      hasTimestamp = timestamp !== null;
      
      // Call the context menu handler with the mouse position and timestamp info
      onContextMenu(e.pageX, e.pageY, hasTimestamp, timestamp);
    };
    
    // Touch support for long press
    const handleTouchStart = (e: TouchEvent) => {
      if (!onContextMenu) return;
      
      // Store touch start position
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.pageX, y: touch.pageY };
      
      // Start a timer for long press detection
      longPressTimer.current = setTimeout(() => {
        if (!touchStartPos.current) return;
        
        // Get the element that was touched
        const target = e.target as HTMLElement;
        
        // Find timestamp in the touched element
        const timestamp = getTimestampFromElement(target);
        const hasTimestamp = timestamp !== null;
        
        // Call the context menu handler with the touch position and timestamp info
        onContextMenu(
          touchStartPos.current.x,
          touchStartPos.current.y,
          hasTimestamp,
          timestamp
        );
        
        // Clear the touch position
        touchStartPos.current = null;
      }, 500); // 500ms is a common duration for long press
    };
    
    const handleTouchMove = () => {
      // If the user moves their finger, cancel the long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
    
    const handleTouchEnd = () => {
      // Cancel the long press timer if the user lifts their finger
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStartPos.current = null;
    };
    
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('mousedown', handleMouseDown);
      editorElement.addEventListener('contextmenu', handleContextMenu);
      editorElement.addEventListener('touchstart', handleTouchStart);
      editorElement.addEventListener('touchmove', handleTouchMove);
      editorElement.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        editorElement.removeEventListener('mousedown', handleMouseDown);
        editorElement.removeEventListener('contextmenu', handleContextMenu);
        editorElement.removeEventListener('touchstart', handleTouchStart);
        editorElement.removeEventListener('touchmove', handleTouchMove);
        editorElement.removeEventListener('touchend', handleTouchEnd);
      };
    }
    
    return () => {};
  }, [editor, playFromTimestamp, onContextMenu]);
  
  // Add visual indicators (faint play icon) for timestamped paragraphs
  useEffect(() => {
    // Track selection changes to update UI indicators
    return mergeRegister(
      editor.registerUpdateListener(({editorState}) => {
        editorState.read(() => {
          // Need to run after DOM update
          setTimeout(() => {
            const paragraphs = editor.getRootElement()?.querySelectorAll('p');
            if (!paragraphs) return;
            
            paragraphs.forEach(p => {
              // Find if any child in this paragraph has a timestamp
              const hasTimestamp = Array.from(p.querySelectorAll('[data-timestamp]')).length > 0;
              
              if (hasTimestamp) {
                p.classList.add('timestamped-paragraph');
                p.setAttribute('data-has-timestamp', 'true');
              } else {
                p.classList.remove('timestamped-paragraph');
                p.removeAttribute('data-has-timestamp');
              }
            });
          }, 0);
        });
      }),
      
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          // Handle selection changes if needed for UI updates
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  }, [editor]);

  // Return the mini player bubble component when it should be shown
  return showBubble ? (
    <MiniPlayerBubble
      position={bubblePosition}
      isPlaying={isPlaying}
      currentTime={currentTime}
      onPlayPause={handlePlayPause}
      onDragEnd={handleBubbleDragEnd}
    />
  ) : null;
}
