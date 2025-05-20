import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Download, Lock, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/context/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { FeatureGate } from "@/components/FeatureGate";

interface TranscriptionDisplayProps {
  transcript: string;
  fileName: string;
  customTitle?: string;
  audioDuration?: number | null;
  onReset: () => void;
}

/**
 * Format transcript text to improve readability
 * - Add proper paragraph breaks
 * - Format potential speaker labels
 * - Convert timestamps to markdown format
 */
const formatTranscript = (text: string): string => {
  if (!text) return "";
  
  // Add line breaks after sentences
  let formatted = text
    // Add paragraph breaks after sentences (periods followed by spaces)
    .replace(/\.\s+/g, '.\n\n')
    // Format potential speaker labels (NAME: text)
    .replace(/([A-Z][a-z]+):\s+/g, '\n\n**$1**: ')
    // Format potential timestamps ([00:00:00])
    .replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, '\n\n*[$1]* ');

  // Clean up excessive line breaks
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ line breaks with just 2
    .trim();

  return formatted;
};

/**
 * Format audio duration into a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "8 mins 20 secs" or "45 secs"
 */
const formatAudioDuration = (seconds: number): string => {
  if (!seconds && seconds !== 0) return "";
  
  // Round to nearest second
  const totalSeconds = Math.round(seconds);
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
  onReset 
}: TranscriptionDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const displayTitle = customTitle || fileName.split('.')[0];
  const formattedTranscript = formatTranscript(transcript);

  // Get subscription information
  const { getTierLimits, currentTier } = useSubscription();
  const availableFormats = getTierLimits('exportFormats');

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
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
    
    // Decide which text to download
    const textToDownload = format === 'plain' ? transcript : formattedTranscript;
    const fileExtension = format === 'plain' ? 'txt' : 'md';
    
    const element = document.createElement("a");
    const file = new Blob([textToDownload], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${displayTitle}.${fileExtension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Transcript downloaded as ${format === 'plain' ? 'text' : 'markdown'}!`);
  };

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const paragraphs = formattedTranscript.split(/\n\s*\n/).filter(Boolean).length;

  // Format audio duration as a user-friendly string
  const formattedDuration = audioDuration ? formatAudioDuration(audioDuration) : null;

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
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Plain Text (.txt)
                  </button>
                  
                  {availableFormats.includes('markdown') ? (
                    <button 
                      onClick={() => handleDownload('markdown')} 
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Markdown (.md)
                    </button>
                  ) : (
                    <div className="block w-full text-left px-4 py-2 text-sm text-gray-400 bg-gray-50 flex items-center">
                      <Lock className="w-3 h-3 mr-1" />
                      Markdown (.md)
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

        <Tabs defaultValue="formatted">
          <TabsList className="mb-4">
            <TabsTrigger value="formatted">Formatted</TabsTrigger>
            <TabsTrigger value="plain">Plain Text</TabsTrigger>
          </TabsList>
          <TabsContent value="formatted">
            <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto prose prose-sm max-w-none">
              <ReactMarkdown>{formattedTranscript}</ReactMarkdown>
            </div>
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
