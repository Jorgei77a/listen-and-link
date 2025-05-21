
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  audioRef?: React.RefObject<HTMLAudioElement>;
}

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onJumpToTime,
  onPlayStateChange,
  audioRef: externalAudioRef
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Create a local audio ref if no external ref is provided
  const internalAudioRef = useRef<HTMLAudioElement>(null);
  // Use the external ref if provided, otherwise use the internal ref
  const audioRef = externalAudioRef || internalAudioRef;
  
  // Memoize the audio source URL to prevent recreation
  const audioSrc = useMemo(() => {
    // Return the src directly if it's not a blob URL
    if (!src.startsWith('blob:')) {
      return src;
    }
    
    // For blob URLs, we can't do much since they're already created
    // In a real implementation, you'd want to cache these at a higher level
    return src;
  }, [src]);
  
  // Handle audio initialization in a single effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Only set the src attribute once when it changes
    if (audio.src !== audioSrc) {
      audio.src = audioSrc;
      
      // Reset state when source changes
      setCurrentTime(0);
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      
      // Load the new source
      audio.load();
    }
    
    return () => {
      // Cleanup only if using internal ref
      if (!externalAudioRef && src.startsWith('blob:')) {
        // Revoke object URL only when component unmounts and only for blob URLs
        // we created internally
        URL.revokeObjectURL(src);
      }
    };
  }, [audioSrc, audioRef, externalAudioRef, src, onPlayStateChange]);
  
  // Set up event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime);
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      // Ensure currentTime is set correctly, accommodating cached values
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    };
    
    // Add event listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    // Handle any jump requests
    if (onJumpToTime) {
      // Implementation would be at component usage level
    }
    
    // Cleanup listeners to prevent memory leaks
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, onTimeUpdate, onJumpToTime, onPlayStateChange]);

  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
        });
      }
    }
  }, [isPlaying, audioRef]);

  const skipForward = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime += 5;
    }
  }, [audioRef]);

  const skipBackward = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 5;
    }
  }, [audioRef]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
  }, [audioRef, onTimeUpdate]);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Define a local function to handle time updates from the audio element
  const localHandleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(audioRef.current.currentTime);
      }
    }
  };

  // Don't create a new audio element on each render
  // Only render the audio element if using the internal ref
  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      {!externalAudioRef && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={localHandleTimeUpdate}  // Changed from handleTimeUpdate to localHandleTimeUpdate
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        
        <Button 
          onClick={skipForward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip forward 5 seconds"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-sm tabular-nums">
          {formatTime(currentTime)}
        </span>
        
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
