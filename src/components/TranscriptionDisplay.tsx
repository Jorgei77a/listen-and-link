import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  Lock, 
  Clock, 
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/context/SubscriptionContext";
import { FeatureGate } from "@/components/FeatureGate";
import TranscriptEditor from "./TranscriptEditor";
import TranscriptAudioPlayer from "./TranscriptAudioPlayer";
import { 
  formatAudioDuration, 
  extractTimestamps, 
  TranscriptSegment,
  findSegmentAtPosition
} from "@/utils/audioUtils";

interface TranscriptionDisplayProps {
  transcript: string;
  fileName: string;
  customTitle?: string;
  audioDuration?: number | null;
  audioUrl?: string | null;
  onReset: () => void;
}

/**
 * Format raw transcript text with improved paragraph detection
 * - Add proper paragraph breaks at sentence endings
 * - Format potential speaker labels
 * - Preserve potential timestamps
 * - Split text into logical paragraphs based on content
 */
const formatTextWithParagraphs = (text: string): string => {
  if (!text) return "";
  
  // First, normalize line breaks
  let formatted = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // If the text already has paragraph breaks, respect them
  if (formatted.includes('\n\n')) {
    return formatted.trim();
  }
  
  // Otherwise, add paragraph breaks after sentences for better readability
  formatted = formatted
    // Add paragraph breaks after sentences with typical ending patterns
    .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2')
    // Format potential speaker labels (NAME: text)
    .replace(/([A-Z][a-z]+):\s*/g, '\n\n$1: ')
    // Preserve timestamps ([00:00:00]) 
    .replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, '[$1] ');

  // Split long paragraphs (more than 3 sentences) for better readability
  const paragraphs = formatted.split('\n\n');
  const enhancedParagraphs = paragraphs.map(paragraph => {
    // Count sentences in this paragraph
    const sentenceCount = (paragraph.match(/[.!?]/g) || []).length;
    
    if (sentenceCount > 3 && paragraph.length > 300) {
      // If it's a long paragraph, add more breaks after sentences
      return paragraph.replace(/([.!?])\s+/g, '$1\n\n');
    }
    return paragraph;
  });
  
  // Join paragraphs back together
  formatted = enhancedParagraphs.join('\n\n');
  
  // Clean up excessive line breaks
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ line breaks with just 2
    .trim();

  return formatted;
};

const TranscriptionDisplay = ({ 
  transcript, 
  fileName, 
  customTitle = "", 
  audioDuration = null,
  audioUrl = null,
  onReset 
}: TranscriptionDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const displayTitle = customTitle || fileName.split('.')[0];
  
  // Process the raw transcript with basic paragraph formatting only
  const formattedText = formatTextWithParagraphs(transcript);

  // Initialize edited content from formatted transcript only on first load
  useEffect(() => {
    // Initialize the editor with formatted text only if editedContent is empty
    if (!editedContent) {
      setEditedContent(formattedText);
    }
    
    // Extract any timestamps from the transcript for audio sync
    const extractedSegments = extractTimestamps(transcript);
    setSegments(extractedSegments);
  }, [transcript, formattedText]);

  // Get subscription information
  const { getTierLimits, currentTier } = useSubscription();
  const availableFormats = getTierLimits('exportFormats');

  const handleCopy = () => {
    // Copy the edited content from Tiptap (HTML) as plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editedContent;
    navigator.clipboard.writeText(tempDiv.textContent || transcript);
    
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  type ExportFormat = 'plain' | 'markdown';

  const handleDownload = (format: ExportFormat) => {
    // Check if format is available in the current tier
    if (!availableFormats.includes(format)) {
      toast.error(`${format} export is not available on your ${currentTier} plan.`, {
        action: {
          label: 'Upgrade',
          onClick: () => {
            toast("This would navigate to upgrade page");
          },
        },
      });
      return;
    }
    
    // For plain text export, convert HTML to plain text
    let textToDownload = transcript; // Default to original transcript
    
    if (editedContent) {
      // Convert HTML to plain text if we have edited content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editedContent;
      textToDownload = tempDiv.textContent || transcript;
    }
    
    // File extension is always txt since we're not using Markdown anymore
    const fileExtension = 'txt';
    
    const element = document.createElement("a");
    const file = new Blob([textToDownload], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${displayTitle}.${fileExtension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Transcript downloaded as text!`);
  };

  const handleEditorChange = (html: string) => {
    setEditedContent(html);
  };
  
  const handleTextClick = (event: MouseEvent, position: number) => {
    // Find the segment containing the clicked position and seek to its timestamp
    const segment = findSegmentAtPosition(segments, position);
    if (segment?.startTime) {
      // We would use onSeek here to update the audio player
      console.log(`Seeking to timestamp: ${segment.startTime}s`);
    }
  };
  
  const handleAudioTimeUpdate = (currentTime: number) => {
    // This would be used to highlight the current segment being played
    console.log(`Audio time updated: ${currentTime}s`);
  };

  // Handle tab changes to preserve editor state
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const paragraphs = formattedText.split(/\n\s*\n/).filter(Boolean).length;

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold truncate max-w-[60%]">{displayTitle}</h2>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy Text"}
            </Button>
            <div className="relative group">
              <Button 
                variant="outline" 
                onClick={() => handleDownload('plain')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg hidden group-hover:block z-10">
                <div className="py-1">
                  <button 
                    onClick={() => handleDownload('plain')} 
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Plain Text (.txt)
                  </button>
                  
                  {availableFormats.includes('markdown') ? (
                    <button 
                      onClick={() => handleDownload('plain')} 
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Text with Formatting (.txt)
                    </button>
                  ) : (
                    <div className="block w-full text-left px-4 py-2 text-sm text-gray-400 bg-gray-50 flex items-center">
                      <Lock className="w-3 h-3 mr-1" />
                      Text with Formatting (.txt)
                      <Badge className="ml-1 text-[10px]" variant="outline">Pro+</Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
            <span className="ml-1">{paragraphs}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center">
            <span className="font-medium">File:</span>
            <span className="ml-1 truncate max-w-[200px]">{fileName}</span>
          </div>
          {audioDuration && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center">
                <span className="font-medium">Duration:</span>
                <span className="ml-1 flex items-center">
                  {formatAudioDuration(audioDuration)}
                  <Badge variant="secondary" className="ml-1 text-xs h-5 px-1 py-0" title="Duration confirmed by transcription service">
                    <Clock className="w-3 h-3 mr-1" /> Confirmed
                  </Badge>
                </span>
              </div>
            </>
          )}
        </div>

        <Tabs defaultValue="editor" value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="plain">Plain Text</TabsTrigger>
          </TabsList>
          
          <TabsContent value="editor">
            <TranscriptEditor 
              content={editedContent || formattedText}
              onChange={handleEditorChange}
              onTextClick={handleTextClick}
            />
            
            <FeatureGate
              featureKey="audio_player"
              description="Audio playback is available on all plans"
            >
              <TranscriptAudioPlayer 
                fileName={fileName}
                audioUrl={audioUrl || undefined}
                onTimeUpdate={handleAudioTimeUpdate}
              />
            </FeatureGate>
          </TabsContent>
          
          <TabsContent value="plain">
            <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {transcript}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 text-center">
          <Button onClick={onReset}>Transcribe Another File</Button>
        </div>
      </div>
    </Card>
  );
};

export default TranscriptionDisplay;
