
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FileUpload from "@/components/FileUpload";
import TranscriptionDisplay from "@/components/TranscriptionDisplay";
import Features from "@/components/Features";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState<string>("");

  // Poll for transcription status if we have an ID
  useEffect(() => {
    if (!currentTranscriptionId) return;
    
    const checkTranscription = async () => {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', currentTranscriptionId)
        .single();
      
      if (error) {
        console.error('Failed to fetch transcription:', error);
        return;
      }
      
      if (data) {
        if (data.status === 'completed' && data.transcript) {
          setTranscript(data.transcript);
          setIsProcessing(false);
          toast.success("Transcription complete!");
        } else if (data.status === 'failed') {
          setIsProcessing(false);
          toast.error(`Transcription failed: ${data.error || 'Unknown error'}`);
        } else if (data.status === 'processing' && data.error) {
          // Show progress messages to the user
          toast.info(data.error, { id: 'processing-status', duration: 2000 });
        }
      }
    };
    
    // Check more frequently initially, then slow down
    let checkCount = 0;
    const initialInterval = setInterval(() => {
      checkTranscription();
      checkCount++;
      
      // After 5 checks (15 seconds), switch to a slower interval
      if (checkCount >= 5) {
        clearInterval(initialInterval);
        
        // Set up a slower polling interval
        const slowInterval = setInterval(checkTranscription, 5000); // every 5 seconds
        return () => clearInterval(slowInterval);
      }
    }, 3000); // every 3 seconds initially
    
    return () => clearInterval(initialInterval);
  }, [currentTranscriptionId]);

  const handleFileUpload = async (file: File, transcriptionId?: string, title?: string) => {
    setIsProcessing(true);
    setCurrentFileName(file.name);
    setCustomTitle(title || file.name.split('.')[0]);
    
    if (transcriptionId) {
      setCurrentTranscriptionId(transcriptionId);
      
      // Show format-specific messages
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (fileExt === 'm4a' || fileExt === 'mp4') {
        setTimeout(() => {
          toast.info("M4A/MP4 files require additional processing time. Please be patient.", { 
            duration: 10000,
            id: 'm4a-processing-notice'
          });
        }, 5000);
      }
    }
  };

  const handleReset = () => {
    setTranscript(null);
    setCurrentFileName("");
    setCurrentTranscriptionId(null);
    setCustomTitle("");
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
              customTitle={customTitle}
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
