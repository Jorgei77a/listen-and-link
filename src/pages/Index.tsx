
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
import { Json } from "@/integrations/supabase/types";

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
          // Cast the data to the appropriate types
          const transcriptionData = data as unknown as {
            id: string;
            file_name: string;
            file_path: string;
            file_size: number;
            custom_title: string | null;
            status: string;
            transcript: string | null;
            error: string | null;
            progress_message: string | null;
            created_at: string | null;
            updated_at: string | null;
            audio_duration: number | null;
            segments: Json | null;
          };
          
          if (transcriptionData.status === 'completed' && transcriptionData.transcript) {
            setTranscript(transcriptionData.transcript);
            setIsProcessing(false);
            
            // Parse segments if available - note that segments may not exist in database yet
            let parsedSegments: TranscriptionSegment[] = [];
            
            // Parse the segments from the JSON data if available
            if (transcriptionData.segments) {
              try {
                if (Array.isArray(transcriptionData.segments)) {
                  // Convert Json array to TranscriptionSegment array
                  parsedSegments = transcriptionData.segments.map((segment: any) => ({
                    start: Number(segment.start),
                    end: Number(segment.end),
                    text: String(segment.text)
                  }));
                }
              } catch (segmentError) {
                console.error('Error parsing segments:', segmentError);
              }
            }
            
            // If no valid segments could be parsed, generate basic segments from the transcript
            if (parsedSegments.length === 0 && transcriptionData.transcript) {
              console.log('No segments found or error parsing, generating basic segments from transcript');
              
              // Simple sentence splitting for segments when no timestamp data is available
              const sentences = transcriptionData.transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
              let currentTime = 0;
              const avgTimePerSentence = transcriptionData.audio_duration ? 
                Math.max(1, transcriptionData.audio_duration / sentences.length) : 3;
              
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
            
            setSegments(parsedSegments);
            
            // Store the audio duration - make sure to round it here
            if (transcriptionData.audio_duration) {
              // Round to nearest integer to ensure no decimal places
              const roundedDuration = Math.round(Number(transcriptionData.audio_duration));
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
          } else if (transcriptionData.status === 'failed') {
            setIsProcessing(false);
            toast.error(`Transcription failed: ${transcriptionData.error || 'Unknown error'}`);
          } else if (transcriptionData.progress_message) {
            // Show progress messages if available
            console.log(`Transcription progress: ${transcriptionData.progress_message}`);
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
