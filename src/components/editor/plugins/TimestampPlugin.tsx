
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
import { Play, SkipBack, Pause, Info } from "lucide-react"; // Add missing imports

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
  onContextMenu?: (x: number, y: number, hasTimestamp: boolean) => void;
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
      if (!editingMode) return;
      
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
    
    // Add handler for right-click / context menu
    const handleContextMenu = (e: MouseEvent) => {
      if (!editingMode || !onContextMenu) return;
      
      // Let's check if the node under the cursor has a timestamp
      let hasTimestamp = false;
      
      editor.getEditorState().read(() => {
        // Get the DOM node that was right-clicked
        // We'll use this to find the corresponding Lexical node
        const domNode = e.target as Node;
        
        // Get the selection based on where the user clicked
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        // Try to find a timestamped node in the current selection or parent hierarchy
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const node = range.startContainer.parentElement;
          
          // Check if the clicked element or its parent has a data-timestamp attribute
          if (node) {
            hasTimestamp = node.hasAttribute('data-timestamp') || 
                          node.parentElement?.hasAttribute('data-timestamp') ||
                          node.closest('[data-timestamp]') !== null;
          }
        }
      });
      
      // Prevent the default browser context menu
      e.preventDefault();
      
      // Call the context menu handler with the mouse position and timestamp info
      onContextMenu(
        e.pageX, 
        e.pageY,
        hasTimestamp
      );
    };
    
    // Touch support for long press - simulate context menu
    const handleTouchStart = (e: TouchEvent) => {
      if (!editingMode || !onContextMenu) return;
      
      // Store touch start position
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.pageX, y: touch.pageY };
      
      // Start a timer for long press detection
      longPressTimer.current = setTimeout(() => {
        if (!touchStartPos.current) return;
        
        // Check if the touch target has a timestamp
        let hasTimestamp = false;
        const touchTarget = e.target as HTMLElement;
        
        if (touchTarget) {
          hasTimestamp = touchTarget.hasAttribute('data-timestamp') || 
                         touchTarget.closest('[data-timestamp]') !== null;
        }
        
        // Call the context menu handler
        onContextMenu(
          touchStartPos.current.x,
          touchStartPos.current.y,
          hasTimestamp
        );
        
        // Clear the touch position
        touchStartPos.current = null;
      }, 500); // 500ms is a common duration for long press
    };
    
    const handleTouchMove = (e: TouchEvent) => {
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
  }, [editor, playFromTimestamp, editingMode, onContextMenu]);
  
  // Add visual indicators (faint play icon) for timestamped paragraphs
  useEffect(() => {
    if (!editingMode) {
      // Remove all indicators if not in editing mode
      const paragraphs = editor.getRootElement()?.querySelectorAll('p');
      if (paragraphs) {
        paragraphs.forEach(p => {
          p.classList.remove('timestamped-paragraph');
          p.removeAttribute('data-has-timestamp');
        });
      }
      return;
    }
    
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
  }, [editor, editingMode]);

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
