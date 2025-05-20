
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
    console.log("📢 AudioPlayer: Toggle Play/Pause called, current state:", isPlaying ? "playing" : "paused");
    
    if (audioRef.current) {
      if (isPlaying) {
        console.log("📢 AudioPlayer: Pausing audio");
        audioRef.current.pause();
      } else {
        console.log("📢 AudioPlayer: Attempting to play audio");
        // Handle play promise to avoid "The play() request was interrupted" errors
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("📢 AudioPlayer: Playback started successfully");
            })
            .catch(error => {
              console.error("📢 AudioPlayer: Playback error:", error);
              // Reset state if playback fails
              setIsPlaying(false);
            });
        }
      }
      setIsPlaying(!isPlaying);
    } else {
      console.error("📢 AudioPlayer: Audio element ref is null");
    }
  };

  const skipForward = () => {
    console.log("📢 AudioPlayer: Skip forward called");
    if (audioRef.current) {
      setIsSeeking(true);
      const newTime = Math.min(audioRef.current.currentTime + 5, duration);
      console.log(`📢 AudioPlayer: Skipping forward to ${newTime}s`);
      jumpToTime(newTime);
    }
  };

  const skipBackward = () => {
    console.log("📢 AudioPlayer: Skip backward called");
    if (audioRef.current) {
      setIsSeeking(true);
      const newTime = Math.max(audioRef.current.currentTime - 5, 0);
      console.log(`📢 AudioPlayer: Skipping backward to ${newTime}s`);
      jumpToTime(newTime);
    }
  };

  // Unified function for jumping to specific time
  const jumpToTime = (time: number) => {
    if (!audioRef.current) {
      console.error("📢 AudioPlayer: jumpToTime - Audio element ref is null");
      return;
    }
    
    console.log(`📢 AudioPlayer: jumpToTime called with time=${time}, current play state=${isPlaying ? "playing" : "paused"}`);
    setIsSeeking(true);
    
    // Update UI immediately for responsiveness
    setCurrentTime(time);
    
    // Log audio element state before seeking
    console.log(`📢 AudioPlayer: Before seeking - currentTime=${audioRef.current.currentTime}, paused=${audioRef.current.paused}, readyState=${audioRef.current.readyState}`);
    
    // Update audio element's time
    audioRef.current.currentTime = time;
    console.log(`📢 AudioPlayer: Set currentTime to ${time}`);
    
    // Trigger the callback if provided
    if (onTimeUpdate) {
      console.log(`📢 AudioPlayer: Calling onTimeUpdate with time=${time}`);
      onTimeUpdate(time);
    }
    
    // Resume playback if it was previously playing
    if (isPlaying) {
      console.log("📢 AudioPlayer: Was playing before seek, attempting to resume playback");
      
      // Small delay to let the seeking operation complete
      setTimeout(() => {
        if (!audioRef.current) return;
        
        console.log(`📢 AudioPlayer: After timeout - currentTime=${audioRef.current.currentTime}, paused=${audioRef.current.paused}, readyState=${audioRef.current.readyState}`);
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("📢 AudioPlayer: Playback resumed successfully after seek");
            })
            .catch(error => {
              console.error("📢 AudioPlayer: Error resuming playback after seek:", error);
              setIsPlaying(false);
            });
        } else {
          console.log("📢 AudioPlayer: Play promise is undefined");
        }
      }, 50);
    } else {
      console.log("📢 AudioPlayer: Was paused before seek, remaining paused");
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime;
      // Only log every second to avoid console spam
      if (Math.floor(newTime) !== Math.floor(currentTime)) {
        console.log(`📢 AudioPlayer: Time updated to ${newTime.toFixed(2)}s`);
      }
      
      setCurrentTime(newTime);
      setIsSeeking(false);
      
      if (onTimeUpdate) {
        onTimeUpdate(newTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      console.log(`📢 AudioPlayer: Audio metadata loaded, duration=${audioDuration}s, src=${src}`);
      setDuration(audioDuration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    console.log(`📢 AudioPlayer: Manual seek to ${time}s via slider`);
    jumpToTime(time);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCanPlay = () => {
    console.log("📢 AudioPlayer: Audio can play event fired");
    setIsLoading(false);
  };

  const handleWaiting = () => {
    console.log("📢 AudioPlayer: Audio waiting event fired");
    setIsLoading(true);
  };

  const handlePlay = () => {
    console.log("📢 AudioPlayer: Audio play event fired");
  };

  const handlePause = () => {
    console.log("📢 AudioPlayer: Audio pause event fired");
  };

  const handleSeeking = () => {
    console.log(`📢 AudioPlayer: Audio seeking event fired, seeking to ${audioRef.current?.currentTime}s`);
    setIsSeeking(true);
  };

  const handleSeeked = () => {
    console.log(`📢 AudioPlayer: Audio seeked event fired, now at ${audioRef.current?.currentTime}s`);
    setIsSeeking(false);
  };

  const handleEnded = () => {
    console.log("📢 AudioPlayer: Audio ended event fired");
    setIsPlaying(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.target as HTMLAudioElement;
    console.error("📢 AudioPlayer: Audio error event fired", target.error);
    setIsLoading(false);
    setIsPlaying(false);
  };

  // Effect to handle external time jumps from text clicks
  useEffect(() => {
    if (onJumpToTime && audioRef.current) {
      console.log("📢 AudioPlayer: Registering jumpToTime callback");
      // Register the jumpToTime function as a callback
      onJumpToTime(jumpToTime);
    }
  }, [onJumpToTime]);

  // Effect to handle src changes
  useEffect(() => {
    if (src) {
      console.log(`📢 AudioPlayer: Source changed to ${src}`);
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      
      // Reset audio element when src changes
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        console.log("📢 AudioPlayer: Audio element reset and reloaded");
      }
    }
  }, [src]);

  // Debug effect to monitor isPlaying state changes
  useEffect(() => {
    console.log(`📢 AudioPlayer: isPlaying state changed to ${isPlaying ? "playing" : "paused"}`);
    
    // Force sync audio element state with component state
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        console.log("📢 AudioPlayer: Detected mismatch - component playing but audio paused, attempting to play");
        const playPromise = audioRef.current.play();
        if (playPromise) {
          playPromise.catch(error => {
            console.error("📢 AudioPlayer: Error syncing play state:", error);
            setIsPlaying(false);
          });
        }
      } else if (!isPlaying && !audioRef.current.paused) {
        console.log("📢 AudioPlayer: Detected mismatch - component paused but audio playing, forcing pause");
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onEnded={handleEnded}
        onError={handleError}
        preload="auto"
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

      {/* Visual debugging indicator for player state */}
      <div className="text-xs text-center text-muted-foreground">
        {isSeeking && <span className="animate-pulse">Seeking... </span>}
        {isLoading && <span className="animate-pulse">Loading... </span>}
        <span className={isPlaying ? "text-green-600" : ""}>
          {isPlaying ? "Playing" : "Paused"}
        </span>
      </div>
    </div>
  );
}
