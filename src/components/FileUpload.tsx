
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProcessingStages, { ProcessingStage } from "./ProcessingStages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface FileUploadProps {
  onFileUpload: (file: File, transcriptionId?: string, customTitle?: string) => void;
  isProcessing: boolean;
}

const FileUpload = ({ onFileUpload, isProcessing }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // New states for tracking processing stages
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploading");
  const [processingProgress, setProcessingProgress] = useState({
    uploading: 0,
    converting: 0,
    transcribing: 0
  });
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Poll for transcription status if we have an ID
  useEffect(() => {
    if (!currentTranscriptionId || !isProcessing) return;
    
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
          if (data.status === 'completed') {
            setProcessingStage('completed');
            setProcessingProgress(prev => ({
              ...prev,
              transcribing: 100
            }));
          } else if (data.status === 'failed') {
            setProcessingStage('failed');
            setProcessingError(data.error || 'Unknown error occurred during processing');
          } else if (data.status === 'processing') {
            // Update progress based on error message which contains progress info
            if (data.error) {
              if (data.error.includes('Converting')) {
                setProcessingStage('converting');
                // Extract percentage if available
                const match = data.error.match(/Converting.*?(\d+)%/);
                const percentage = match ? parseInt(match[1]) : 50;
                
                setProcessingProgress(prev => ({
                  ...prev,
                  uploading: 100,
                  converting: percentage || 50
                }));
              } else if (data.error.includes('Processing') || data.error.includes('chunk') || data.error.includes('transcrib')) {
                setProcessingStage('transcribing');
                // Extract percentage if available or calculate based on chunks
                const chunkMatch = data.error.match(/segment (\d+) of (\d+)/i);
                let transcribingProgress = 20; // Default progress
                
                if (chunkMatch && chunkMatch[1] && chunkMatch[2]) {
                  const currentChunk = parseInt(chunkMatch[1]);
                  const totalChunks = parseInt(chunkMatch[2]);
                  transcribingProgress = Math.round((currentChunk / totalChunks) * 100);
                }
                
                setProcessingProgress(prev => ({
                  ...prev,
                  uploading: 100,
                  converting: 100,
                  transcribing: transcribingProgress
                }));
              }
            }
          }
        }
      } catch (err) {
        console.error("Error checking transcription status:", err);
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
  }, [currentTranscriptionId, isProcessing]);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Check file type - updated to match Whisper supported formats
    const validAudioTypes = [
      'audio/mpeg', // mp3, mpga
      'audio/wav',  // wav
      'audio/mp3',  
      'audio/mp4',  // mp4
      'audio/webm', // webm
      'audio/m4a',  // m4a
      'audio/x-m4a',// m4a alternative MIME type
      'audio/mpga', // mpga
      'audio/mpeg' // alternative MIME type for mp3
    ];
    
    // Also check file extension as backup validation
    const validExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (!validAudioTypes.includes(file.type) && !validExtensions.includes(fileExt || '')) {
      toast.error("Please upload a supported audio file format (MP3, MP4, M4A, WAV, WEBM)");
      return;
    }

    setSelectedFile(file);
    // Set a default title based on file name without extension
    setCustomTitle(file.name.split('.').slice(0, -1).join('.'));
    
    // Open the dialog immediately after file is selected
    setDialogOpen(true);
    
    // Show format-specific notifications
    if (fileExt === 'm4a' || fileExt === 'mp4') {
      toast.info("M4A/MP4 files will be converted for better processing. This may take longer.", {
        duration: 5000
      });
    }
    
    toast.success(`File "${file.name}" selected`);
  };

  const handleDialogClose = () => {
    if (!uploading) {
      setDialogOpen(false);
      // We don't reset the selected file here to allow the user to reopen the dialog
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    // Use the custom title or fallback to the filename if empty
    const finalTitle = customTitle.trim() || selectedFile.name.split('.').slice(0, -1).join('.');
    
    setDialogOpen(false);
    setUploading(true);
    setUploadProgress(0);
    setProcessingStage("uploading");
    setProcessingProgress({
      uploading: 0,
      converting: 0,
      transcribing: 0
    });
    setProcessingError(null);

    try {
      // Create a unique file path
      const uploadFileExt = selectedFile.name.split('.').pop();
      const filePath = `${uuidv4()}.${uploadFileExt}`;

      // Simulate upload progress since we can't use onUploadProgress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          // Cap at 90% until we confirm upload is complete
          if (prev < 90) {
            const newProgress = prev + 5;
            setProcessingProgress(prevState => ({
              ...prevState,
              uploading: newProgress
            }));
            return newProgress;
          }
          return prev;
        });
      }, 200);

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audio_files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setProcessingProgress(prev => ({
        ...prev,
        uploading: 100
      }));

      if (uploadError) {
        setProcessingStage("failed");
        setProcessingError(`Error uploading file: ${uploadError.message}`);
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }

      // Start the transcription process
      const response = await fetch('https://btfhfujdrvvkdiobitsb.supabase.co/functions/v1/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.getSession()}`
        },
        body: JSON.stringify({
          filePath: filePath,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          customTitle: finalTitle
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setProcessingStage("failed");
        setProcessingError(errorData.error || "Unknown error occurred");
        throw new Error(`Transcription error: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      setCurrentTranscriptionId(result.id);
      
      // Using the file extension we already obtained for validation
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'm4a' || fileExtension === 'mp4') {
        setProcessingStage("converting");
        // Don't show toast, we'll use the UI indicators instead
      } else {
        setProcessingStage("transcribing");
        // Don't show toast, we'll use the UI indicators instead
      }
      
      // Pass the file, transcription ID, and custom title to parent component
      onFileUpload(selectedFile, result.id, finalTitle);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if a file is an m4a/mp4 format
  const isM4aFormat = (file: File | null): boolean => {
    if (!file) return false;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'm4a' || ext === 'mp4';
  };

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto p-6 shadow-lg">
        <div className="space-y-6">
          {!isProcessing && !uploading && (
            <div 
              className={`file-drop-area border-2 border-dashed rounded-lg p-8 ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Drag and drop your audio file</h3>
                  <p className="text-sm text-muted-foreground">Or click to browse files</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports MP3, WAV, M4A, MP4, and other audio formats
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-4"
                  disabled={isProcessing || uploading}
                >
                  Select File
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept="audio/*"
                  onChange={handleChange}
                  disabled={isProcessing || uploading}
                />
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress 
                value={uploadProgress} 
              />
              <p className="text-xs text-muted-foreground text-center">
                Please wait while your file is being uploaded
              </p>
            </div>
          )}

          {isProcessing && !uploading && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-center">Processing Your Audio</h3>
              
              {selectedFile && (
                <div className="bg-muted rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-primary text-sm">🎵</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                        {isM4aFormat(selectedFile) && (
                          <span className="text-amber-600 ml-2">
                            (Format conversion in progress)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <ProcessingStages 
                currentStage={processingStage}
                progress={processingProgress}
                error={processingError}
              />
              
              <p className="text-xs text-muted-foreground text-center mt-6">
                {processingStage === "transcribing" && "Transcription time varies based on audio length and complexity"}
                {processingStage === "converting" && "M4A/MP4 files require format conversion for optimal transcription"}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!uploading) {
          setDialogOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name Your Transcript</DialogTitle>
            <DialogDescription>
              Provide a title for this audio transcription. The default uses the file name.
            </DialogDescription>
          </DialogHeader>
          
          {selectedFile && (
            <div className="p-4 bg-muted rounded-lg mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-primary text-sm">🎵</span>
                </div>
                <div>
                  <p className="font-medium text-sm truncate max-w-[200px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                    {selectedFile.size > 23 * 1024 * 1024 && (
                      <span className="text-yellow-600 ml-2">
                        (Will be chunked for processing)
                      </span>
                    )}
                    {isM4aFormat(selectedFile) && (
                      <span className="text-amber-600 block mt-1">
                        M4A/MP4 format will be converted for better processing
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="transcript-title" className="text-sm">Transcript Title</Label>
            <Input
              id="transcript-title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Enter a title for your transcript"
              className="w-full"
              disabled={isProcessing || uploading}
              autoComplete="off"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This title will be used for the transcript and download file name
            </p>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button 
              variant="outline" 
              onClick={handleDialogClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isProcessing || uploading}
              className="ml-2"
            >
              Transcribe Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileUpload;
