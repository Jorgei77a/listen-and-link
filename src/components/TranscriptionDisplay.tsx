
import { useState, useEffect, useCallback } from "react";
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
import { formatTimestamp } from "@/utils/audioSyncUtils";
import { useSubscription } from "@/context/SubscriptionContext";

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
  // State management
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [editor, setEditor] = useState<LexicalEditorType | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [jumpToTimeHandler, setJumpToTimeHandler] = useState<((time: number) => void) | null>(null);
  
  const displayTitle = customTitle || fileName.split('.')[0];

  // Handle copy action
  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle editor mounting
  const handleEditorMount = (editorInstance: LexicalEditorType) => {
    console.log("Editor mounted successfully");
    setEditor(editorInstance);
    setEditorReady(true);
  };

  const handleEditorChange = (editorState: EditorState) => {
    // Handle editor changes if needed
  };

  // Handle time updates from the audio player
  const handleTimeUpdate = useCallback((time: number) => {
    console.log(`Time updated: ${time}s`);
    setCurrentTime(time);
  }, []);

  // Set up the jump to time handler that will be passed to the editor
  // Updated to correctly handle the function signature
  const handleJumpToTimeSetup = useCallback((jumpHandler: (time: number) => void) => {
    console.log("Jump to time handler set up");
    setJumpToTimeHandler(() => jumpHandler);
  }, []);

  // Handle segment click from transcript
  const handleSegmentClick = useCallback((time: number) => {
    console.log(`Segment clicked, jumping to time: ${time}s`);
    if (jumpToTimeHandler) {
      jumpToTimeHandler(time);
    }
  }, [jumpToTimeHandler]);

  // Handle playback state change
  const handlePlaybackStateChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  // Extract statistics from the transcript
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const paragraphCount = segments?.length || transcript.split(/\n\s*\n/).filter(Boolean).length;

  // Format audio duration as a user-friendly string
  const formattedDuration = audioDuration !== null ? formatAudioDuration(audioDuration) : null;
  const currentTimeFormatted = currentTime !== null ? formatTimestamp(currentTime) : "00:00";

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold truncate max-w-[60%]">{displayTitle}</h2>
            {isPlaying && currentTime !== null && (
              <span className="text-xs text-muted-foreground mt-1">
                Currently at {currentTimeFormatted}
              </span>
            )}
          </div>
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

        {/* Audio Player (placed before editor for better UX) */}
        {audioUrl && (
          <div className="mb-4">
            <AudioPlayer 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate} 
              onJumpToTime={handleJumpToTimeSetup}
              onPlaybackStateChange={handlePlaybackStateChange}
            />
          </div>
        )}

        {/* Lexical Editor */}
        <LexicalEditor 
          initialText={transcript}
          segments={segments}
          className="mt-4"
          onEditorMount={handleEditorMount}
          onEditorChange={handleEditorChange}
          currentTimeInSeconds={currentTime}
          onJumpToTime={handleSegmentClick}
        />
        
        <div className="mt-6 text-center">
          <Button onClick={onReset}>Transcribe Another File</Button>
        </div>
      </div>
    </Card>
  );
}

export default TranscriptionDisplay;
