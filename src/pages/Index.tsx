
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

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState<string>("");
  const [transcriptionCompleted, setTranscriptionCompleted] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  
  const { updateMonthlyUsage } = useSubscription();

  // Poll for transcription status if we have an ID
  useEffect(() => {
    if (!currentTranscriptionId) return;
    
    const checkTranscription = async () => {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*, audio_duration, segments, file_path')
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
          
          // Store segments if available
          if (data.segments) {
            try {
              let parsedSegments: TranscriptionSegment[] = [];
              
              if (typeof data.segments === 'string') {
                parsedSegments = JSON.parse(data.segments);
              } else if (Array.isArray(data.segments)) {
                parsedSegments = data.segments;
              }
              
              setSegments(parsedSegments);
            } catch (error) {
              console.error('Failed to parse segments:', error);
            }
          }
          
          // Create signed URL for the audio file
          if (data.file_path) {
            const { data: signedUrl } = await supabase.storage
              .from('audio_files')
              .createSignedUrl(data.file_path, 3600); // 1 hour expiry
              
            if (signedUrl?.signedUrl) {
              setAudioUrl(signedUrl.signedUrl);
            }
          }
          
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

  const handleFileUpload = async (file: File, transcriptionId?: string, title?: string) => {
    setIsProcessing(true);
    setCurrentFileName(file.name);
    setCustomTitle(title || file.name.split('.')[0]);
    setTranscriptionCompleted(false);
    setAudioDuration(null);
    setAudioUrl("");
    setSegments([]);
    
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
    setAudioUrl("");
    setSegments([]);
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
              segments={segments}
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
