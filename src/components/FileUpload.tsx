
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Lock, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/context/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
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
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  
  // Use our subscription context
  const { 
    getTierLimits, 
    currentTier, 
    hasFeature, 
    userUsage,
    checkMonthlyUsage,
    updateMonthlyUsage 
  } = useSubscription();
  
  const maxFileSize = getTierLimits('maxFileSize');
  const maxMonthlyMinutes = getTierLimits('maxMonthlyMinutes');
  const canUseCustomTitles = hasFeature('custom_titles');
  
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

  // Estimate audio duration based on file size and format
  const estimateAudioDuration = (file: File): number => {
    // Format-specific bitrate estimates in bits per second
    const bitrates: {[key: string]: number} = {
      'mp3': 128000,    // 128 kbps
      'mp4': 192000,    // 192 kbps
      'm4a': 192000,    // 192 kbps
      'wav': 1411000,   // CD quality, 1411 kbps
      'webm': 128000,   // Varies widely, using 128 kbps as estimate
      'mpeg': 128000,   // 128 kbps
      'mpga': 128000,   // 128 kbps
    };
    
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const bitrate = bitrates[fileExt] || 128000;
    
    // Calculate duration in seconds (file size in bits / bitrate)
    const durationSeconds = Math.round((file.size * 8) / bitrate);
    
    return durationSeconds;
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

    // Check file size against tier limit
    if (file.size > maxFileSize) {
      const sizeMB = Math.round(maxFileSize / (1024 * 1024));
      toast.error(
        `File exceeds the ${sizeMB}MB limit for your ${currentTier} plan. Please upgrade for larger files.`,
        {
          action: {
            label: 'Upgrade',
            onClick: () => {
              toast("This would navigate to upgrade page");
            },
          },
        }
      );
      return;
    }
    
    // Estimate audio duration and check against monthly limits
    const estimatedSeconds = estimateAudioDuration(file);
    setEstimatedDuration(estimatedSeconds);
    
    // Check if adding this audio would exceed monthly limits
    if (userUsage && !checkMonthlyUsage(estimatedSeconds)) {
      const estimatedMinutes = Math.round(estimatedSeconds / 60);
      toast.error(
        `This ${estimatedMinutes} minute audio would exceed your monthly limit of ${maxMonthlyMinutes} minutes. Please upgrade your plan.`,
        {
          action: {
            label: 'Upgrade',
            onClick: () => {
              toast("This would navigate to upgrade page");
            },
          },
        }
      );
      return;
    }

    setSelectedFile(file);
    // Set a default title based on file name without extension
    setCustomTitle(file.name.split('.').slice(0, -1).join('.'));
    
    // Open the dialog immediately after file is selected
    setDialogOpen(true);
    
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
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
      
      // If we have an estimated duration, preemptively update usage
      // The actual duration will be updated when processing completes
      if (estimatedDuration !== null) {
        try {
          await updateMonthlyUsage(estimatedDuration);
        } catch (error) {
          console.error('Failed to update usage estimate:', error);
        }
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

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 
      ? `${minutes} min ${remainingSeconds} sec`
      : `${minutes} minutes`;
  };

  // Calculate max size for display
  const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto p-6 shadow-lg">
        <div className="space-y-6">
          {userUsage && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Monthly Usage</span>
                </div>
                <span className="text-sm">
                  {Math.round(userUsage.minutesUsed)} / {userUsage.monthlyLimit} minutes
                </span>
              </div>
              <Progress 
                value={userUsage.percentUsed}
                className={userUsage.percentUsed > 90 ? "bg-red-100" : ""} 
              />
              <p className="text-xs text-muted-foreground text-right">
                {userUsage.percentUsed >= 100 
                  ? "Monthly limit reached. Upgrade to process more audio." 
                  : `${Math.round(userUsage.monthlyLimit - userUsage.minutesUsed)} minutes remaining this month`
                }
              </p>
            </div>
          )}

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
                  Supports MP3, WAV, OGG, and other audio formats (max {maxSizeMB}MB)
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <Badge variant="outline" className="text-xs">
                    {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Plan
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {maxMonthlyMinutes} minutes per month
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4"
                disabled={isProcessing || uploading || (userUsage?.percentUsed || 0) >= 100}
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
                    {estimatedDuration && (
                      <span className="ml-2">
                        • Est. duration: {formatTime(estimatedDuration)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {canUseCustomTitles ? (
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
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transcript-title-locked" className="text-sm">Transcript Title</Label>
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Lock className="h-3 w-3" /> Pro Feature
                </Badge>
              </div>
              <Input
                id="transcript-title-locked"
                value={selectedFile?.name.split('.').slice(0, -1).join('.') || ""}
                className="w-full bg-muted cursor-not-allowed"
                disabled={true}
                readOnly
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Custom titles require a Pro plan or higher
              </p>
            </div>
          )}

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
