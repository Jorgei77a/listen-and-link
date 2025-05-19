
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload = ({ onFileUpload, isProcessing }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    // Check file type
    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/webm'];
    if (!validAudioTypes.includes(file.type)) {
      toast.error("Please upload an audio file (MP3, WAV, OGG, etc.)");
      return;
    }

    setSelectedFile(file);
    toast.success(`File "${file.name}" selected`);
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
    } else {
      toast.error("Please select a file first");
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
          className={`file-drop-area ${dragActive ? 'active' : ''}`}
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
              disabled={isProcessing}
            >
              Select File
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="audio/*"
              onChange={handleChange}
              disabled={isProcessing}
            />
          </div>
        </div>

        {selectedFile && (
          <div className="bg-muted p-4 rounded-lg">
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
              <Button 
                onClick={handleSubmit} 
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Transcribe Now"}
              </Button>
            </div>
          </div>
        )}

        {isProcessing && (
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
              Large files may take several minutes to process
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default FileUpload;
