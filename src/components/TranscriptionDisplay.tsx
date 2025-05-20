import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LexicalEditor } from "@/components/editor/LexicalEditor";
import { AudioPlayer } from "@/components/editor/AudioPlayer";
import { ExportOptions } from "@/components/editor/ExportOptions";
import { EditorState, LexicalEditor as LexicalEditorType } from "lexical";
import { SEGMENT_TIMING } from "@/utils/audioUtils";

interface TranscriptionDisplayProps {
  transcript: string;
  fileName: string;
  customTitle?: string;
  audioDuration?: number | null;
  audioUrl?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  onReset: () => void;
}

/**
 * Format audio duration into a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "8 mins 20 secs" or "45 secs"
 */
const formatAudioDuration = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return "";
  
  // Force conversion to number, then round to nearest integer to eliminate decimals
  const totalSeconds = Math.round(Number(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
  } else if (remainingSeconds === 0) {
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
  } else {
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
  }
};

const TranscriptionDisplay = ({ 
  transcript, 
  fileName, 
  customTitle = "", 
  audioDuration = null,
  audioUrl = "",
  segments = [],
  onReset 
}: TranscriptionDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [editor, setEditor] = useState<LexicalEditorType | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Stable refs to prevent infinite loops
  const audioPlayerCallbackRef = useRef<((time: number) => void) | null>(null);
  const lastSegmentClickTimeRef = useRef<number>(0);
  const isUpdatingFromPlayerRef = useRef<boolean>(false);
  const isUpdatingFromEditorRef = useRef<boolean>(false);
  const currentTimeRef = useRef<number | null>(currentTime);
  const isFirstTimeUpdateRef = useRef<boolean>(true);
  const segmentsRef = useRef(segments);
  
  // Keep currentTimeRef in sync
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  
  // Keep segmentsRef in sync
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Sync debug mode with audioUtils
  useEffect(() => {
    SEGMENT_TIMING.DEBUG = debugMode;
  }, [debugMode]);
  
  const displayTitle = customTitle || fileName.split('.')[0];

  // Memoized handlers
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }, [transcript]);

  const handleEditorMount = useCallback((editorInstance: LexicalEditorType) => {
    setEditor(editorInstance);
    setEditorReady(true);
  }, []);

  const handleEditorChange = useCallback((editorState: EditorState) => {
    // Handle editor changes if needed
  }, []);

  // Stabilized time update handler from AudioPlayer with heavy debounce
  const handleTimeUpdate = useCallback((time: number) => {
    // Skip first update as it's often triggered on load with time=0
    if (isFirstTimeUpdateRef.current) {
      isFirstTimeUpdateRef.current = false;
      return;
    }
    
    // Prevent updates while editor is sending time updates to player
    if (isUpdatingFromEditorRef.current) return;
    
    // Signal that we're updating from player
    isUpdatingFromPlayerRef.current = true;
    
    // Only update if the time has actually changed
    if (currentTimeRef.current === null || Math.abs((currentTimeRef.current || 0) - time) > 0.5) {
      setCurrentTime(time);
    }
    
    // Reset the lock after a delay
    setTimeout(() => {
      isUpdatingFromPlayerRef.current = false;
    }, 300);
  }, []);

  // Heavily debounced segment click handler
  const handleSegmentClick = useCallback((time: number) => {
    // Prevent multiple rapid clicks or updates while player is updating editor
    if (isUpdatingFromPlayerRef.current) return;
    
    // Simple strong debounce for rapid clicks
    const now = Date.now();
    if (now - lastSegmentClickTimeRef.current < 1000) {
      return;
    }
    lastSegmentClickTimeRef.current = now;
    
    // Signal that we're updating from editor
    isUpdatingFromEditorRef.current = true;
    
    // Only update if there's actually a change
    if (currentTimeRef.current === null || Math.abs((currentTimeRef.current || 0) - time) > 0.2) {
      setCurrentTime(time);
      
      // Call the audio player's jumpToTime function with delay to ensure state is updated
      setTimeout(() => {
        if (audioPlayerCallbackRef.current) {
          audioPlayerCallbackRef.current(time);
        }
      }, 50);
    }
    
    // Reset the lock after a delay
    setTimeout(() => {
      isUpdatingFromEditorRef.current = false;
    }, 300);
  }, []);

  // Register the jump-to-time callback with cleanup
  const handleJumpToTimeRegistration = useCallback((callback: (time: number) => void) => {
    // Store the callback in a stable ref that won't change
    audioPlayerCallbackRef.current = callback;
    setPlayerReady(true);
    
    // Return cleanup function
    return () => {
      audioPlayerCallbackRef.current = null;
      setPlayerReady(false);
    };
  }, []);

  // Toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
  }, []);

  // Extract statistics from the transcript
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const paragraphCount = segments?.length || transcript.split(/\n\s*\n/).filter(Boolean).length;

  // Format audio duration as a user-friendly string
  const formattedDuration = audioDuration !== null ? formatAudioDuration(audioDuration) : null;

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold truncate max-w-[60%]">{displayTitle}</h2>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy Text"}
            </Button>
            <ExportOptions editor={editor} title={displayTitle} />
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center">
            <span className="font-medium">Words:</span>
            <span className="ml-1">{wordCount}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center">
            <span className="font-medium">Paragraphs:</span>
            <span className="ml-1">{paragraphCount}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center">
            <span className="font-medium">File:</span>
            <span className="ml-1 truncate max-w-[200px]">{fileName}</span>
          </div>
          {formattedDuration && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center">
                <span className="font-medium">Duration:</span>
                <span className="ml-1 flex items-center">
                  {formattedDuration}
                  <Badge variant="secondary" className="ml-1 text-xs h-5 px-1 py-0" title="Duration confirmed by transcription service">
                    <Clock className="w-3 h-3 mr-1" /> Confirmed
                  </Badge>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Lexical Editor with optimized props */}
        <LexicalEditor 
          initialText={transcript}
          segments={segments}
          className="mb-4"
          onEditorMount={handleEditorMount}
          onEditorChange={handleEditorChange}
          currentTimeInSeconds={currentTime}
          onSegmentClick={handleSegmentClick}
        />
        
        {/* Audio Player with optimized props */}
        {audioUrl && (
          <div className="mt-4">
            <AudioPlayer 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate} 
              onJumpToTime={handleJumpToTimeRegistration}
            />
          </div>
        )}
        
        {/* Debug information and controls */}
        <div className="mt-4 p-2 bg-gray-50 rounded-md text-xs text-muted-foreground">
          <div className="flex justify-between items-center">
            <p>Status: {audioUrl ? "✅ Audio loaded" : "❌ No audio"}, Editor: {editorReady ? "✅ Ready" : "❌ Loading"}, Player: {playerReady ? "✅ Ready" : "❌ Loading"}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs"
              onClick={toggleDebugMode}
            >
              {debugMode ? "Disable Debug" : "Enable Debug"}
            </Button>
          </div>
          {currentTime !== null && <p>Position: {currentTime.toFixed(2)}s</p>}
          {debugMode && (
            <div className="mt-2 border-t pt-2 text-xs">
              <p>Segment Buffers: End={SEGMENT_TIMING.END_BUFFER}s, Lookahead={SEGMENT_TIMING.LOOKAHEAD}s</p>
              <p>Overlap Priority: {SEGMENT_TIMING.OVERLAP_PRIORITY}</p>
              {segments.length > 0 && (
                <p>Segments: {segments.length}, First: {segments[0].start}s-{segments[0].end}s, Last: {segments[segments.length-1].start}s-{segments[segments.length-1].end}s</p>
              )}
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <Button onClick={onReset}>Transcribe Another File</Button>
        </div>
      </div>
    </Card>
  );
};

export default TranscriptionDisplay;
