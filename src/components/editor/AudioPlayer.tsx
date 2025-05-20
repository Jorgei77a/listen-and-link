
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Loader2 } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (callback: (time: number) => void) => void;
}

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onJumpToTime
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Handle play promise to avoid "The play() request was interrupted" errors
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Playback started successfully
            })
            .catch(error => {
              console.error("Playback error:", error);
              // Reset state if playback fails
              setIsPlaying(false);
            });
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      setIsSeeking(true);
      const newTime = Math.min(audioRef.current.currentTime + 5, duration);
      jumpToTime(newTime);
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      setIsSeeking(true);
      const newTime = Math.max(audioRef.current.currentTime - 5, 0);
      jumpToTime(newTime);
    }
  };

  // Unified function for jumping to specific time
  const jumpToTime = (time: number) => {
    if (!audioRef.current) return;
    
    setIsSeeking(true);
    
    // Update UI immediately for responsiveness
    setCurrentTime(time);
    
    // Update audio element's time
    audioRef.current.currentTime = time;
    
    // Trigger the callback if provided
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
    
    // Resume playback if it was previously playing
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback resumed successfully
          })
          .catch(error => {
            console.error("Error resuming playback after seek:", error);
            setIsPlaying(false);
          });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setIsSeeking(false);
      if (onTimeUpdate) {
        onTimeUpdate(audioRef.current.currentTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    jumpToTime(time);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  // Effect to handle external time jumps from text clicks
  useEffect(() => {
    if (onJumpToTime && audioRef.current) {
      // Register the jumpToTime function as a callback
      onJumpToTime(jumpToTime);
    }
  }, [onJumpToTime]);

  // Effect to handle src changes
  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [src]);

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onEnded={() => setIsPlaying(false)}
      />
      
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
          disabled={isLoading || currentTime === 0}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
          disabled={isLoading || !src}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
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
          disabled={isLoading || currentTime >= duration}
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
          className={cn(
            "flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer",
            isSeeking && "opacity-80"
          )}
          disabled={isLoading || !src}
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
