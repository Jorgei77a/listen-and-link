
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FileUpload from "@/components/FileUpload";
import TranscriptionDisplay from "@/components/TranscriptionDisplay";
import Features from "@/components/Features";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { useSubscription } from "@/context/SubscriptionContext";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState<string>("");
  const [transcriptionCompleted, setTranscriptionCompleted] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const { updateMonthlyUsage } = useSubscription();

  // Poll for transcription status if we have an ID
  useEffect(() => {
    if (!currentTranscriptionId) return;
    
    const checkTranscription = async () => {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*, audio_duration')
        .eq('id', currentTranscriptionId)
        .single();
      
      if (error) {
        console.error('Failed to fetch transcription:', error);
        return;
      }
      
      if (data) {
        if (data.status === 'completed' && data.transcript) {
          // Format the transcript with proper paragraph breaks
          const formattedTranscript = formatTranscriptText(data.transcript);
          setTranscript(formattedTranscript);
          setIsProcessing(false);
          
          // Store the audio duration - make sure to round it here
          if (data.audio_duration) {
            // Round to nearest integer to ensure no decimal places
            const roundedDuration = Math.round(Number(data.audio_duration));
            setAudioDuration(roundedDuration);
            
            // Update monthly usage with the actual audio duration from the server
            try {
              await updateMonthlyUsage(roundedDuration);
              console.log(`Updated usage with confirmed duration: ${roundedDuration}s`);
            } catch (error) {
              console.error('Failed to update usage with confirmed duration:', error);
            }
          }
          
          // Only show completion toast if we haven't already
          if (!transcriptionCompleted) {
            toast.success("Transcription complete!");
            setTranscriptionCompleted(true);
          }
        } else if (data.status === 'failed') {
          setIsProcessing(false);
          toast.error(`Transcription failed: ${data.error || 'Unknown error'}`);
        } else if (data.progress_message) {
          // Show progress messages if available
          console.log(`Transcription progress: ${data.progress_message}`);
        }
      }
    };
    
    const intervalId = setInterval(checkTranscription, 3000);
    return () => clearInterval(intervalId);
  }, [currentTranscriptionId, transcriptionCompleted, updateMonthlyUsage]);

  // Helper function to format transcript text into proper paragraphs
  const formatTranscriptText = (text: string): string => {
    if (!text) return "";
    
    // Format text with paragraph breaks for better readability
    let formatted = text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Add paragraph breaks after sentences that end with a period followed by a capital letter
      .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2')
      
      // Add paragraph breaks before speaker changes
      .replace(/([a-z])\s+([A-Z][a-z]+):\s*/g, '$1\n\n$2: ')
      
      // Preserve timestamps if they exist
      .replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, '[$1] ')
      
      // Clean up excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      .trim();
      
    return formatted;
  };

  const handleFileUpload = async (file: File, transcriptionId?: string, title?: string) => {
    setIsProcessing(true);
    setCurrentFileName(file.name);
    setCustomTitle(title || file.name.split('.')[0]);
    setTranscriptionCompleted(false);
    setAudioDuration(null);
    
    // Create and store URL for the audio file
    const audioObjectUrl = URL.createObjectURL(file);
    setAudioUrl(audioObjectUrl);
    
    if (transcriptionId) {
      setCurrentTranscriptionId(transcriptionId);
    }
  };

  const handleReset = () => {
    setTranscript(null);
    setCurrentFileName("");
    setCurrentTranscriptionId(null);
    setCustomTitle("");
    setTranscriptionCompleted(false);
    setAudioDuration(null);
    
    // Clean up object URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
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
            <div className="flex items-center justify-center gap-2">
              <p className="text-lg text-muted-foreground">
                Upload your audio file and get accurate transcription powered by OpenAI's Whisper
              </p>
              <SubscriptionBadge />
            </div>
          </div>

          {transcript ? (
            <TranscriptionDisplay 
              transcript={transcript} 
              fileName={currentFileName}
              customTitle={customTitle}
              audioDuration={audioDuration}
              audioUrl={audioUrl}
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
