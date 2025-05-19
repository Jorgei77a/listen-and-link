
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface TranscriptionDisplayProps {
  transcript: string;
  fileName: string;
  onReset: () => void;
}

const TranscriptionDisplay = ({ 
  transcript, 
  fileName, 
  onReset 
}: TranscriptionDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([transcript], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${fileName.split('.')[0]}_transcript.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Transcript downloaded!");
  };

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const paragraphs = transcript.split(/\n\s*\n/).filter(Boolean).length;

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Transcription Complete</h2>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy Text"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
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
        </div>

        <Tabs defaultValue="transcript">
          <TabsList className="mb-4">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="transcript">
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
