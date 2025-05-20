
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

// Define the Transcription interface to match the database structure
interface Transcription {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  custom_title?: string | null;
  status: string;
  transcript?: string | null;
  error?: string | null;
  progress_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  audio_duration?: number | null;
  segments?: TranscriptionSegment[] | null;
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
      try {
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
          const transcription = data as Transcription;
          
          if (transcription.status === 'completed' && transcription.transcript) {
            setTranscript(transcription.transcript);
            setIsProcessing(false);
            
            // Parse segments if available - note that segments may not exist in database yet
            let parsedSegments: TranscriptionSegment[] = [];
            
            // We'll generate basic segments from the transcript if needed
            if (!transcription.segments) {
              console.log('No segments found, generating basic segments from transcript');
              
              // Simple sentence splitting for segments when no timestamp data is available
              if (transcription.transcript) {
                const sentences = transcription.transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
                let currentTime = 0;
                const avgTimePerSentence = transcription.audio_duration ? 
                  Math.max(1, transcription.audio_duration / sentences.length) : 3;
                
                parsedSegments = sentences.map((sentence, index) => {
                  const segmentStart = currentTime;
                  currentTime += avgTimePerSentence;
                  return {
                    start: segmentStart,
                    end: currentTime,
                    text: sentence.trim()
                  };
                });
              }
            } else {
              // Handle segments if they exist in the response
              parsedSegments = Array.isArray(transcription.segments) ? 
                transcription.segments : 
                [];
            }
            
            setSegments(parsedSegments);
            
            // Create signed URL for the audio file
            if (transcription.file_path) {
              const { data: signedUrl } = await supabase.storage
                .from('audio_files')
                .createSignedUrl(transcription.file_path, 3600); // 1 hour expiry
                
              if (signedUrl?.signedUrl) {
                setAudioUrl(signedUrl.signedUrl);
              }
            }
            
            // Store the audio duration - make sure to round it here
            if (transcription.audio_duration) {
              // Round to nearest integer to ensure no decimal places
              const roundedDuration = Math.round(Number(transcription.audio_duration));
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
          } else if (transcription.status === 'failed') {
            setIsProcessing(false);
            toast.error(`Transcription failed: ${transcription.error || 'Unknown error'}`);
          } else if (transcription.progress_message) {
            // Show progress messages if available
            console.log(`Transcription progress: ${transcription.progress_message}`);
          }
        }
      } catch (error) {
        console.error('Error checking transcription status:', error);
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
