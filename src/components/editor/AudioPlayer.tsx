
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
  const userInteractionRef = useRef<boolean>(false);
  const seekingRef = useRef<boolean>(false);

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
      userInteractionRef.current = true;
      audioRef.current.currentTime += 5;
    }
  };

  const skipBackward = () => {
    if (audioRef.current && ready) {
      userInteractionRef.current = true;
      audioRef.current.currentTime -= 5;
    }
  };

  // Handle time updates
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime;
      setCurrentTime(newTime);
      if (onTimeUpdate) {
        onTimeUpdate(newTime);
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
  const handleSeekStart = () => {
    seekingRef.current = true;
    userInteractionRef.current = true;
  };

  const handleSeekEnd = () => {
    seekingRef.current = false;
    // Allow time for the currentTime to update
    setTimeout(() => {
      userInteractionRef.current = false;
    }, 200);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    
    if (audioRef.current) {
      userInteractionRef.current = true;
      audioRef.current.currentTime = time;
      setCurrentTime(time);
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
    // Only process if we have a valid jumpToTime value
    if (jumpToTime !== null && jumpToTime !== undefined && 
        audioRef.current && ready) {
      
      // Force jump if it's a new request time OR we need to re-jump to the same time
      const shouldJump = jumpToTime !== lastJumpTimeRef.current || !jumpHandledRef.current;

      if (shouldJump) {
        console.log(`Jumping to time: ${jumpToTime}`);
        
        // Update our refs to track this jump
        jumpHandledRef.current = true;
        lastJumpTimeRef.current = jumpToTime;
        
        // Set the current time and force an update
        audioRef.current.currentTime = jumpToTime;
        setCurrentTime(jumpToTime);
        
        // Always play when jumping to a new time
        audioRef.current.play().catch(error => {
          console.error("Audio playback after jump failed:", error);
        });
      }
    }
  }, [jumpToTime, ready]);

  // Clean up jumpHandledRef whenever jumpToTime changes back to null
  useEffect(() => {
    if (jumpToTime === null) {
      jumpHandledRef.current = false;
    }
  }, [jumpToTime]);

  // Make sure audio element stays in sync with our state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekingRef.current || userInteractionRef.current) return;

    // Only update if there's a significant difference to avoid loops
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

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
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onTouchStart={handleSeekStart}
          onTouchEnd={handleSeekEnd}
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
