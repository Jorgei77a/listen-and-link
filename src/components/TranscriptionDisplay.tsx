import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExportOptions } from "@/components/editor/ExportOptions";
import { AudioPlayer } from "@/components/editor/AudioPlayer";
import { EditableInteractiveTranscript } from "@/components/editor/EditableInteractiveTranscript";
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
  
  const displayTitle = customTitle || fileName.split('.')[0];

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
    const now = Date.now();
    // Debounce clicks to prevent rapid-fire jumps if desired
    if (now - lastJumpTimeRef.current < 200) { 
      console.log("Segment click debounced");
      return;
    }
    lastJumpTimeRef.current = now;

    console.log(`TranscriptionDisplay: Setting jumpToTime to ${segment.start}`);
    setJumpToTime(segment.start);
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
        
        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-4 mb-4">
            <AudioPlayer 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate}
              onPlaybackStateChange={handlePlaybackStateChange}
              jumpToTime={jumpToTime}
            />
          </div>
        )}
        
        {/* Editable Interactive Transcript - combines navigation and editing */}
        {segments && segments.length > 0 && (
          <div className="mt-4 border rounded-md">
            <h3 className="text-lg font-medium px-4 pt-3 pb-1">Transcript</h3>
            <EditableInteractiveTranscript
              segments={segments}
              currentTime={currentTime}
              onSegmentClick={handleSegmentClick}
              isPlaying={isPlaying}
              className="h-[400px]"
              onEditorMount={handleEditorMount}
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
