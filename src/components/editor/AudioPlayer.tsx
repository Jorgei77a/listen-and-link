
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  jumpToTime?: number | null;
}

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onPlaybackStateChange,
  jumpToTime
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const jumpHandledRef = useRef<boolean>(false);
  const lastJumpTimeRef = useRef<number | null>(null);

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current || !ready) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error("Audio playback failed:", error);
      });
    }
  };

  // Skip forward/backward
  const skipForward = () => {
    if (audioRef.current && ready) {
      audioRef.current.currentTime += 5;
    }
  };

  const skipBackward = () => {
    if (audioRef.current && ready) {
      audioRef.current.currentTime -= 5;
    }
  };

  // Handle time updates
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(audioRef.current.currentTime);
      }
    }
  };

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setReady(true);
    }
  };

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlaybackStateChange) {
        onPlaybackStateChange(true);
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (onPlaybackStateChange) {
        onPlaybackStateChange(false);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (onPlaybackStateChange) {
        onPlaybackStateChange(false);
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onPlaybackStateChange]);

  // Handle external time jump requests
  useEffect(() => {
    // Only process if jumpToTime has a value and either:
    // 1. It's a different time than the last jump we processed OR
    // 2. We haven't processed any jumps yet
    if (jumpToTime !== null && jumpToTime !== undefined && 
        audioRef.current && ready && 
        (!jumpHandledRef.current || jumpToTime !== lastJumpTimeRef.current)) {
      
      // Update our refs to track this jump
      jumpHandledRef.current = true;
      lastJumpTimeRef.current = jumpToTime;
      
      // Set the current time and play
      audioRef.current.currentTime = jumpToTime;
      
      // Always play when jumping to a new time
      audioRef.current.play().catch(error => {
        console.error("Audio playback after jump failed:", error);
      });
    }
  }, [jumpToTime, ready]);

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
          disabled={!ready}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
          disabled={!ready}
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
          disabled={!ready}
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
          disabled={!ready}
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
