
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LexicalEditor } from "@/components/editor/LexicalEditor";
import { ExportOptions } from "@/components/editor/ExportOptions";
import { EditorState, LexicalEditor as LexicalEditorType } from "lexical";

interface TranscriptionDisplayProps {
  transcript: string;
  fileName: string;
  customTitle?: string;
  audioDuration?: number | null;
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
  segments = [],
  onReset 
}: TranscriptionDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<LexicalEditorType | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  
  const displayTitle = customTitle || fileName.split('.')[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditorMount = (editorInstance: LexicalEditorType) => {
    console.log("Editor mounted successfully");
    setEditor(editorInstance);
    setEditorReady(true);
  };

  const handleEditorChange = (editorState: EditorState) => {
    // Handle editor changes if needed
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
                <span className="ml-1">{formattedDuration}</span>
              </div>
            </>
          )}
        </div>

        {/* Lexical Editor without audio integration */}
        <LexicalEditor 
          initialText={transcript}
          segments={segments}
          className="mb-4"
          onEditorMount={handleEditorMount}
          onEditorChange={handleEditorChange}
        />
        
        <div className="mt-6 text-center">
          <Button onClick={onReset}>Transcribe Another File</Button>
        </div>
      </div>
    </Card>
  );
};

export default TranscriptionDisplay;
