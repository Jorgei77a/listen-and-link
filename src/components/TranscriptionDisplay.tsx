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
  
  // Refs to prevent infinite loops and throttle updates
  const audioPlayerCallbackRef = useRef<((time: number) => void) | null>(null);
  const lastSegmentClickTimeRef = useRef<number>(0);
  const lastTimeUpdateRef = useRef<number>(0);
  const isUpdatingTimeRef = useRef<boolean>(false);
  const currentTimeRef = useRef<number | null>(currentTime);
  
  // Keep currentTimeRef in sync
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  
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

  // Throttled time update handler with loop prevention
  const handleTimeUpdate = useCallback((time: number) => {
    // Prevent rapid updates
    if (Date.now() - lastTimeUpdateRef.current < 100) return;
    lastTimeUpdateRef.current = Date.now();
    
    // Prevent setting the same time
    if (currentTimeRef.current !== null && Math.abs(time - currentTimeRef.current) < 0.1) return;
    
    // Prevent recursive updates
    if (isUpdatingTimeRef.current) return;
    
    isUpdatingTimeRef.current = true;
    setCurrentTime(time);
    
    // Release lock after a small delay
    setTimeout(() => {
      isUpdatingTimeRef.current = false;
    }, 50);
  }, []);

  // Debounced segment click handler
  const handleSegmentClick = useCallback((time: number) => {
    // Simple debounce for rapid clicks
    const now = Date.now();
    if (now - lastSegmentClickTimeRef.current < 500) {
      return;
    }
    lastSegmentClickTimeRef.current = now;
    
    // Prevent recursive updates
    if (isUpdatingTimeRef.current) return;
    
    isUpdatingTimeRef.current = true;
    setCurrentTime(time);
    
    // Call the audio player's jumpToTime function
    if (audioPlayerCallbackRef.current) {
      audioPlayerCallbackRef.current(time);
    }
    
    // Release lock after a small delay
    setTimeout(() => {
      isUpdatingTimeRef.current = false;
    }, 100);
  }, []);

  // Register the jump-to-time callback with cleanup
  const handleJumpToTimeRegistration = useCallback((callback: (time: number) => void) => {
    audioPlayerCallbackRef.current = callback;
    setPlayerReady(true);
    
    return () => {
      audioPlayerCallbackRef.current = null;
    };
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
        
        {/* Simplified debug information */}
        <div className="mt-4 p-2 bg-gray-50 rounded-md text-xs text-muted-foreground">
          <p>Status: {audioUrl ? "✅ Audio loaded" : "❌ No audio"}, Editor: {editorReady ? "✅ Ready" : "❌ Loading"}, Player: {playerReady ? "✅ Ready" : "❌ Loading"}</p>
          {currentTime !== null && <p>Position: {currentTime.toFixed(2)}s</p>}
        </div>
        
        <div className="mt-6 text-center">
          <Button onClick={onReset}>Transcribe Another File</Button>
        </div>
      </div>
    </Card>
  );
};

export default TranscriptionDisplay;
