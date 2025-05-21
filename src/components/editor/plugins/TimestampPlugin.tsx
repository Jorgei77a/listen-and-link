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
import { createPortal } from "react-dom";
import { AudioContextMenu } from "../AudioContextMenu";
import { Play, SkipBack, Pause, Info } from "lucide-react";

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
  bubbleHideTimeout?: number;  // Added config option
}

export function TimestampPlugin({
  audioRef,
  isPlaying,
  setIsPlaying,
  currentTime,
  leadInOffset = 1.0,  // Using default here, can be overridden by props
  editingMode,
  bubbleHideTimeout = 4000  // Default 4s timeout, can be configured
}: TimestampPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });
  const lastClickedTimestamp = useRef<number | null>(null);
  const bubbleTimeoutRef = useRef<number | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTimestamp, setContextMenuTimestamp] = useState<number | null>(null);
  
  // Function to clear the bubble hide timeout
  const clearBubbleTimeout = useCallback(() => {
    if (bubbleTimeoutRef.current !== null) {
      window.clearTimeout(bubbleTimeoutRef.current);
      bubbleTimeoutRef.current = null;
    }
  }, []);

  // Function to set a new bubble hide timeout
  const scheduleBubbleHide = useCallback(() => {
    clearBubbleTimeout();
    bubbleTimeoutRef.current = window.setTimeout(() => {
      setShowBubble(false);
    }, bubbleHideTimeout);
  }, [bubbleHideTimeout, clearBubbleTimeout]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearBubbleTimeout();
      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, [clearBubbleTimeout]);

  // Handle showing the player bubble with auto-hide
  useEffect(() => {
    if (showBubble) {
      scheduleBubbleHide();
    }
  }, [showBubble, scheduleBubbleHide]);

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
    // Reset the auto-hide timer when the bubble is dragged
    scheduleBubbleHide();
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
  
  // Find timestamp at current position
  const getTimestampAtPosition = useCallback((x: number, y: number): number | null => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return null;
    
    // Try to get element at position
    const elementAtPosition = document.elementFromPoint(x, y);
    if (!elementAtPosition) return null;
    
    // Check if it's a timestamped node or find the closest one
    const timestampAttr = elementAtPosition.getAttribute('data-timestamp');
    if (timestampAttr) {
      return parseFloat(timestampAttr);
    }
    
    // Look for parent with timestamp
    const closestTimestamped = elementAtPosition.closest('[data-timestamp]');
    if (closestTimestamped) {
      return parseFloat(closestTimestamped.getAttribute('data-timestamp') || '0');
    }
    
    // Find closest earlier timestamp in paragraph
    const paragraph = elementAtPosition.closest('p');
    if (paragraph) {
      const timestamps = Array.from(paragraph.querySelectorAll('[data-timestamp]'))
        .map(el => parseFloat(el.getAttribute('data-timestamp') || '0'))
        .filter(ts => !isNaN(ts))
        .sort((a, b) => a - b);
      
      if (timestamps.length > 0) {
        return timestamps[0]; // Return earliest timestamp in paragraph
      }
    }
    
    return null;
  }, [editor]);
  
  // Handle context menu
  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (!editingMode) return;
    
    // Prevent default browser context menu
    e.preventDefault();
    
    // Get timestamp at position
    const timestamp = getTimestampAtPosition(e.clientX, e.clientY);
    setContextMenuTimestamp(timestamp);
    
    // Position context menu
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, [editingMode, getTimestampAtPosition]);
  
  // Handle touch events for long-press
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!editingMode) return;
    
    // Clear any existing timeout
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
    
    // Set a timeout for long-press (500ms)
    longPressTimeoutRef.current = window.setTimeout(() => {
      const touch = e.touches[0];
      if (touch) {
        // Get timestamp at position
        const timestamp = getTimestampAtPosition(touch.clientX, touch.clientY);
        setContextMenuTimestamp(timestamp);
        
        // Position context menu
        setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
        setShowContextMenu(true);
        
        // Prevent default behavior after detecting long press
        e.preventDefault();
      }
    }, 500);
  }, [editingMode, getTimestampAtPosition]);
  
  // Clear long-press timeout on touch end
  const handleTouchEnd = useCallback(() => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);
  
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
    
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('mousedown', handleMouseDown);
      editorElement.addEventListener('contextmenu', handleContextMenu);
      editorElement.addEventListener('touchstart', handleTouchStart);
      editorElement.addEventListener('touchend', handleTouchEnd);
      return () => {
        editorElement.removeEventListener('mousedown', handleMouseDown);
        editorElement.removeEventListener('contextmenu', handleContextMenu);
        editorElement.removeEventListener('touchstart', handleTouchStart);
        editorElement.removeEventListener('touchend', handleTouchEnd);
      };
    }
    
    return () => {};
  }, [editor, playFromTimestamp, editingMode, handleContextMenu, handleTouchStart, handleTouchEnd]);
  
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
            
            // Add dotted underline to user-typed (non-timestamped) text nodes
            const allTextSpans = editor.getRootElement()?.querySelectorAll('span');
            if (allTextSpans) {
              allTextSpans.forEach(span => {
                if (!span.hasAttribute('data-timestamp') && !span.classList.contains('unsynced-text')) {
                  span.classList.add('unsynced-text');
                }
              });
            }
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

  // Context menu handlers
  const handlePlayFromContextMenu = useCallback(() => {
    if (contextMenuTimestamp !== null) {
      playFromTimestamp(contextMenuTimestamp);
      setShowContextMenu(false);
    }
  }, [contextMenuTimestamp, playFromTimestamp]);

  const handlePlayEarlierFromContextMenu = useCallback(() => {
    if (contextMenuTimestamp !== null) {
      playFromTimestamp(contextMenuTimestamp, -5.0); // 5 seconds earlier
      setShowContextMenu(false);
    }
  }, [contextMenuTimestamp, playFromTimestamp]);

  const handlePauseFromContextMenu = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setShowContextMenu(false);
    }
  }, [audioRef, setIsPlaying]);

  // Return both the mini player bubble and audio context menu
  return (
    <>
      {showBubble && (
        <MiniPlayerBubble
          position={bubblePosition}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onPlayPause={handlePlayPause}
          onDragEnd={handleBubbleDragEnd}
        />
      )}
      {createPortal(
        showContextMenu && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100,
              pointerEvents: "none",
            }}
            onClick={() => setShowContextMenu(false)}
          >
            <div
              style={{
                position: "absolute",
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
                pointerEvents: "auto",
              }}
            >
              <div className="bg-background border rounded-md shadow-md">
                <div className="p-2">
                  <button
                    className={`flex items-center w-full text-left px-2 py-1.5 text-sm rounded-sm ${
                      contextMenuTimestamp === null
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    }`}
                    onClick={handlePlayFromContextMenu}
                    disabled={contextMenuTimestamp === null}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Play from here
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-2 py-1.5 text-sm rounded-sm ${
                      contextMenuTimestamp === null
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    }`}
                    onClick={handlePlayEarlierFromContextMenu}
                    disabled={contextMenuTimestamp === null}
                  >
                    <SkipBack className="h-4 w-4 mr-2" />
                    Play 5s earlier
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-2 py-1.5 text-sm rounded-sm ${
                      !isPlaying
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    }`}
                    onClick={handlePauseFromContextMenu}
                    disabled={!isPlaying}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </button>
                  {contextMenuTimestamp === null && (
                    <div className="border-t mt-1 pt-1 px-2 py-1.5 text-sm text-muted-foreground flex items-center">
                      <Info className="h-4 w-4 mr-2" />
                      No original audio for this text
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </>
  );
}
