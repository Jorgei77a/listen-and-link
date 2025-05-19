
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FileUpload from "@/components/FileUpload";
import TranscriptionDisplay from "@/components/TranscriptionDisplay";
import Features from "@/components/Features";
import { toast } from "sonner";

// This is a placeholder function - once Supabase integration is added,
// the actual transcription logic will be implemented using Supabase edge functions
const transcribeAudio = async (file: File): Promise<string> => {
  // This is a mock function - the real implementation will use Supabase
  return new Promise((resolve) => {
    // Simulate processing delay
    setTimeout(() => {
      const mockTranscript = `This is a placeholder transcription for the file "${file.name}".
      
In the actual implementation, this audio would be processed through OpenAI's Whisper API via a Supabase edge function.

For files over 22MB, the system will:
1. Split the file into smaller chunks
2. Process each chunk separately
3. Combine the results into a single transcript

To implement the actual functionality, please connect this project to Supabase.`;
      
      resolve(mockTranscript);
    }, 3000); // 3 second delay to simulate processing
  });
};

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setCurrentFileName(file.name);
    
    try {
      // Show size-based messaging
      if (file.size > 22 * 1024 * 1024) {
        toast.info("Large file detected. It will be split into chunks for processing.");
      }
      
      const result = await transcribeAudio(file);
      setTranscript(result);
      toast.success("Transcription complete!");
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setTranscript(null);
    setCurrentFileName("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="container py-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 gradient-text">
              Audio to Text in Seconds
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your audio file and get accurate transcription powered by OpenAI's Whisper
            </p>
          </div>

          {transcript ? (
            <TranscriptionDisplay 
              transcript={transcript} 
              fileName={currentFileName} 
              onReset={handleReset} 
            />
          ) : (
            <FileUpload 
              onFileUpload={handleFileUpload} 
              isProcessing={isProcessing} 
            />
          )}
        </div>
        
        {!transcript && <Features />}
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
