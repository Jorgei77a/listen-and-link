
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExportOptions } from "@/components/editor/ExportOptions";
import { AudioPlayer } from "@/components/editor/AudioPlayer";
import { InteractiveTranscript } from "@/components/editor/InteractiveTranscript";
import { EditorState, LexicalEditor as LexicalEditorType } from "lexical";
import { TranscriptSegment } from "@/utils/transcriptSyncUtils";

interface TranscriptionDisplayProps {
  transcript: string;
  fileName: string;
  customTitle?: string;
  audioDuration?: number | null;
  audioUrl?: string;
  segments?: TranscriptSegment[];
  onReset: () => void;
}

/**
 * Format audio duration into a human-readable string
 */
const formatAudioDuration = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return "";
  
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
  const [currentTime, setCurrentTime] = useState(0);
  const [jumpToTime, setJumpToTime] = useState<number | null>(null);
  const [editor, setEditor] = useState<LexicalEditorType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastJumpTimeRef = useRef<number>(0);
  const jumpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const displayTitle = customTitle || fileName.split('.')[0];

  // Clear any pending jump timeout when component unmounts
  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
      }
    };
  }, []);

  // Handle copy button click
  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle editor mount
  const handleEditorMount = (editorInstance: LexicalEditorType) => {
    setEditor(editorInstance);
  };

  // Handle audio time update
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // Handle segment click to jump to specific timestamp
  const handleSegmentClick = (segment: TranscriptSegment) => {
    // Cancel any pending timeout to reset jumpToTime
    if (jumpTimeoutRef.current) {
      clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = null;
    }
    
    const now = Date.now();
    // Prevent rapid-fire clicks (ensure minimal delay between jumps)
    if (now - lastJumpTimeRef.current < 300) {
      return;
    }
    
    lastJumpTimeRef.current = now;
    
    // First set jumpToTime to null to reset the jump handled state in AudioPlayer
    setJumpToTime(null);
    
    // Then set the new jump time after a short delay to ensure state updates properly
    setTimeout(() => {
      setJumpToTime(segment.start);
      
      // Reset jumpToTime after a delay so that we can jump to the same segment again if needed
      jumpTimeoutRef.current = setTimeout(() => {
        setJumpToTime(null);
        jumpTimeoutRef.current = null;
      }, 300);
    }, 50);
  };

  // Handle playback state changes
  const handlePlaybackStateChange = (playingState: boolean) => {
    setIsPlaying(playingState);
  };

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
        
        {/* Interactive Transcript */}
        {segments && segments.length > 0 && (
          <div className="mb-6 border rounded-md">
            <InteractiveTranscript
              segments={segments}
              currentTime={currentTime}
              onSegmentClick={handleSegmentClick}
              isPlaying={isPlaying}
              className="h-[300px]"
            />
          </div>
        )}
        
        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-4 mb-6">
            <AudioPlayer 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate}
              onPlaybackStateChange={handlePlaybackStateChange}
              jumpToTime={jumpToTime}
            />
          </div>
        )}
        
        <div className="mt-6 text-center">
          <Button onClick={onReset}>Transcribe Another File</Button>
        </div>
      </div>
    </Card>
  );
};

export default TranscriptionDisplay;
