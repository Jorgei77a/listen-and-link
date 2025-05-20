
import { useState, useRef, useEffect } from "react";
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
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [editor, setEditor] = useState<LexicalEditorType | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isTranscriptReady, setIsTranscriptReady] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  
  const displayTitle = customTitle || fileName.split('.')[0];

  // Prepare the transcript data once it's available
  useEffect(() => {
    if (transcript) {
      // Check if we have a valid transcript
      console.log("Received transcript with length:", transcript.length);
      console.log("Received segments count:", segments?.length || 0);
      
      // For security: Wait a bit longer for the DOM to be fully ready before loading editor
      const timer = setTimeout(() => {
        setIsTranscriptReady(true);
      }, 500); // Increased delay from 300ms to 500ms
      
      return () => clearTimeout(timer);
    }
  }, [transcript, segments]);
  
  // Allow a short delay for the editor to initialize properly
  useEffect(() => {
    if (!isTranscriptReady) return;
    
    const timer = setTimeout(() => {
      setIsEditorReady(true);
      console.log("Editor initialization ready flag set to true");
    }, 700); // Increased delay from 500ms to 700ms
    
    return () => clearTimeout(timer);
  }, [isTranscriptReady]);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditorMount = (editorInstance: LexicalEditorType) => {
    console.log("Editor instance mounted and ready");
    setEditor(editorInstance);
  };

  const handleEditorChange = (editorState: EditorState) => {
    // Handle editor changes if needed
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const jumpToTime = (time: number) => {
    // This would be called when clicking on a paragraph with a timestamp
    setCurrentTime(time);
  };

  // Extract statistics from the transcript
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const paragraphCount = segments?.length || transcript.split(/\n\s*\n/).filter(Boolean).length;

  // Format audio duration as a user-friendly string
  const formattedDuration = audioDuration !== null ? formatAudioDuration(audioDuration) : null;
  
  // Monitor editor container
  useEffect(() => {
    if (isEditorReady && editorContainerRef.current) {
      console.log("Editor container dimensions:", 
        editorContainerRef.current.clientWidth, 
        editorContainerRef.current.clientHeight);
    }
  }, [isEditorReady]);

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

        {/* Lexical Editor with container ref for monitoring */}
        <div ref={editorContainerRef}>
          {isEditorReady && isTranscriptReady ? (
            <LexicalEditor 
              initialText={transcript}
              segments={segments}
              className="mb-4"
              onEditorMount={handleEditorMount}
              onEditorChange={handleEditorChange}
              currentTimeInSeconds={currentTime}
            />
          ) : (
            <div className="mb-4 border rounded-md">
              <div className="bg-muted/30 min-h-[200px] p-4 rounded-md">
                <div className="space-y-2">
                  <div className="h-4 bg-muted/50 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-muted/50 rounded w-full animate-pulse" />
                  <div className="h-4 bg-muted/50 rounded w-5/6 animate-pulse" />
                  <div className="h-4 bg-muted/50 rounded w-4/5 animate-pulse" />
                  <div className="h-4 bg-muted/50 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-4">
            <AudioPlayer 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate} 
              onJumpToTime={jumpToTime}
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
