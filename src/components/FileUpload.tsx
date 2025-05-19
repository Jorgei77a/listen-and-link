
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    toast.success(`File "${file.name}" selected`);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    // Use the custom title or fallback to the filename if empty
    const finalTitle = customTitle.trim() || selectedFile.name.split('.').slice(0, -1).join('.');

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create a unique file path
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${uuidv4()}.${fileExt}`;

      // Simulate upload progress since we can't use onUploadProgress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          // Cap at 90% until we confirm upload is complete
          if (prev < 90) {
            return prev + 5;
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

      if (uploadError) {
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
        throw new Error(`Transcription error: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      toast.success('File uploaded and transcription started');
      
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

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 shadow-lg">
      <div className="space-y-6">
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
                Supports MP3, WAV, OGG, and other audio formats
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

        {selectedFile && (
          <div className="bg-muted p-4 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
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
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="transcript-title" className="text-sm">Transcript Title</Label>
              <Input
                id="transcript-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Enter a title for your transcript"
                className="w-full"
                disabled={isProcessing || uploading}
              />
              <p className="text-xs text-muted-foreground">
                This title will be used for the transcript and download file name
              </p>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit} 
                disabled={isProcessing || uploading}
              >
                {uploading ? "Uploading..." : "Transcribe Now"}
              </Button>
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
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing</span>
              <span>Please wait...</span>
            </div>
            <Progress 
              value={50} 
              className="animate-pulse-slow" 
            />
            <p className="text-xs text-muted-foreground text-center">
              Processing transcription with OpenAI Whisper
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default FileUpload;
