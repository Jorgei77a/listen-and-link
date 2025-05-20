import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Loader2 } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (callback: (time: number) => void) => void | (() => void);
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
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Refs to prevent infinite loops
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekQueueRef = useRef<number | null>(null);
  const playAfterSeekRef = useRef(false);
  const seekOperationInProgressRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);
  const timeUpdateThrottleRef = useRef(false);
  const prevTimeRef = useRef(0);
  
  // Stable references for event callbacks and props
  const srcRef = useRef(src);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const lastReportedTimeRef = useRef(-1);
  const updateLockRef = useRef(false);
  const audioLoadedRef = useRef(false);
  const continuousPlayRef = useRef<boolean>(true); // Ensure continuous playback
  const timeUpdateCallbackEnabledRef = useRef<boolean>(true); // Control callback triggering
  
  // Stabilize references when props change, but don't trigger effects
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Only update source ref if the actual source string changes
  useEffect(() => {
    if (src !== srcRef.current) {
      srcRef.current = src;
      audioLoadedRef.current = false;
    }
  }, [src]);

  // Memoized toggle play/pause to prevent recreating on every render
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playAudio();
    }
  }, [isPlaying]);

  // Separated play logic
  const playAudio = useCallback(() => {
    if (!audioRef.current || !audioLoadedRef.current) return;
    
    // Handle buffering state
    if (audioRef.current.readyState < 3) {
      setIsBuffering(true);
    }
    
    // Ensure continuous play
    continuousPlayRef.current = true;
    
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            setIsPlaying(false);
            setIsBuffering(false);
            console.error("Audio play error:", error);
          }
        });
    }
  }, []);

  // Memoized skip functions
  const skipForward = useCallback(() => {
    if (audioRef.current && !updateLockRef.current) {
      // First disable time update callbacks briefly to prevent feedback
      timeUpdateCallbackEnabledRef.current = false;
      
      const newTime = Math.min(audioRef.current.currentTime + 5, duration);
      jumpToTime(newTime);
      
      // Re-enable callbacks after a small delay
      setTimeout(() => {
        timeUpdateCallbackEnabledRef.current = true;
      }, 300);
    }
  }, [duration]);

  const skipBackward = useCallback(() => {
    if (audioRef.current && !updateLockRef.current) {
      // First disable time update callbacks briefly to prevent feedback
      timeUpdateCallbackEnabledRef.current = false;
      
      const newTime = Math.max(audioRef.current.currentTime - 5, 0);
      jumpToTime(newTime);
      
      // Re-enable callbacks after a small delay
      setTimeout(() => {
        timeUpdateCallbackEnabledRef.current = true;
      }, 300);
    }
  }, []);

  // Revised jumpToTime function with better state management
  const jumpToTime = useCallback((time: number) => {
    if (!audioRef.current || !audioLoadedRef.current) return;
    
    // Prevent jumps to 0 unless explicitly requested and significant
    if (time < 0.1 && audioRef.current.currentTime > 1) {
      console.warn("Prevented unexpected jump to position 0");
      return;
    }
    
    // Prevent triggering time updates while seeking or for small changes
    if (Math.abs(time - prevTimeRef.current) < 0.1) return;
    prevTimeRef.current = time;
    
    // If seeking in progress, queue this request
    if (seekOperationInProgressRef.current) {
      seekQueueRef.current = time;
      return;
    }
    
    // Set seeking flags
    updateLockRef.current = true;
    seekOperationInProgressRef.current = true;
    setIsSeeking(true);
    
    // Update UI
    setCurrentTime(time);
    
    // Store play state
    const wasPlaying = isPlaying || audioRef.current.paused === false;
    playAfterSeekRef.current = wasPlaying;
    
    // Set time without triggering unnecessary callbacks
    try {
      audioRef.current.currentTime = time;
    } catch (err) {
      console.warn("Could not set audio time, possibly not loaded yet:", err);
      updateLockRef.current = false;
      seekOperationInProgressRef.current = false;
      return;
    }
    
    // Temporarily disable time update callbacks
    timeUpdateCallbackEnabledRef.current = false;
    
    // Release update lock after a short delay
    setTimeout(() => {
      updateLockRef.current = false;
      
      // Re-enable time update callbacks
      setTimeout(() => {
        timeUpdateCallbackEnabledRef.current = true;
      }, 300);
      
      // Only call external updates if the time has changed enough
      if (onTimeUpdateRef.current && Math.abs(time - lastReportedTimeRef.current) > 0.1) {
        lastReportedTimeRef.current = time;
        
        setTimeout(() => {
          if (onTimeUpdateRef.current) {
            onTimeUpdateRef.current(time);
          }
        }, 50);
      }
    }, 100);
  }, [isPlaying]);

  // Throttled time update handling
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || updateLockRef.current) return;
    
    // Prevent audio reset to position 0 unless we've actually reached the end
    if (audioRef.current.currentTime < 0.1 && !audioRef.current.paused && 
        prevTimeRef.current > 1 && audioRef.current.duration - prevTimeRef.current > 1) {
      
      console.warn("Detected unexpected reset to position 0, restoring position");
      audioRef.current.currentTime = prevTimeRef.current;
      return;
    }
    
    const newTime = audioRef.current.currentTime;
    prevTimeRef.current = newTime;
    
    // Debounce frequent updates
    if (Date.now() - lastTimeUpdateRef.current < 200) {
      if (!timeUpdateThrottleRef.current) {
        timeUpdateThrottleRef.current = true;
        setTimeout(() => {
          timeUpdateThrottleRef.current = false;
        }, 200);
      }
      return;
    }
    
    lastTimeUpdateRef.current = Date.now();
    
    // Only update if time changed significantly (prevents loops)
    if (Math.abs(newTime - currentTime) > 0.2) {
      setCurrentTime(newTime);
      
      // Only call external updates if enabled and not seeking
      if (timeUpdateCallbackEnabledRef.current && onTimeUpdateRef.current && 
          !seekOperationInProgressRef.current && 
          Math.abs(newTime - lastReportedTimeRef.current) > 0.2) {
        
        lastReportedTimeRef.current = newTime;
        onTimeUpdateRef.current(newTime);
      }
    }
  }, [currentTime]);

  // Optimized audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      setDuration(audioDuration);
      setIsLoading(false);
      audioLoadedRef.current = true;
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (updateLockRef.current) return;
    const time = parseFloat(e.target.value);
    
    // Temporarily disable time update callbacks
    timeUpdateCallbackEnabledRef.current = false;
    jumpToTime(time);
    
    // Re-enable callbacks after a delay
    setTimeout(() => {
      timeUpdateCallbackEnabledRef.current = true;
    }, 300);
  }, [jumpToTime]);

  // Memoized formatting function
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Optimized event handlers
  const handleCanPlay = useCallback(() => {
    audioLoadedRef.current = true;
    setIsLoading(false);
    setIsBuffering(false);
  }, []);

  const handleWaiting = useCallback(() => {
    if (!audioLoadedRef.current) return;
    setIsBuffering(true);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    if (!seekOperationInProgressRef.current) {
      setIsPlaying(false);
    }
  }, []);

  const handleSeeking = useCallback(() => {
    setIsSeeking(true);
    setIsBuffering(true);
  }, []);

  const handleSeeked = useCallback(() => {
    if (!audioRef.current) return;
    
    const currentSeekTime = audioRef.current.currentTime;
    
    // Clear seeking states
    setIsSeeking(false);
    setIsBuffering(false);
    
    // Always resume playback if it was playing before or continuous play is enabled
    if ((playAfterSeekRef.current || continuousPlayRef.current) && audioLoadedRef.current) {
      // Reset flag
      playAfterSeekRef.current = false;
      
      // Delayed resume to let browser catch up
      setTimeout(() => {
        if (audioRef.current && audioLoadedRef.current) {
          playAudio();
        }
      }, 100);
    }
    
    // Process queued seeks
    setTimeout(() => {
      seekOperationInProgressRef.current = false;
      
      if (seekQueueRef.current !== null) {
        const nextSeekTime = seekQueueRef.current;
        seekQueueRef.current = null;
        jumpToTime(nextSeekTime);
      }
    }, 200);
  }, [playAudio]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    
    // Only send time update when actually ended
    if (onTimeUpdateRef.current && audioRef.current) {
      const finalTime = audioRef.current.duration;
      lastReportedTimeRef.current = finalTime;
      onTimeUpdateRef.current(finalTime);
    }
  }, []);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error("Audio error:", (e.target as HTMLAudioElement).error);
    setIsLoading(false);
    setIsPlaying(false);
    setIsBuffering(false);
    seekOperationInProgressRef.current = false;
    audioLoadedRef.current = false;
  }, []);

  // Jump to time registration with proper cleanup
  useEffect(() => {
    if (onJumpToTime && audioRef.current) {
      // Pass a stabilized version of jumpToTime that ensures playback continues
      const stableJumpToTimeCallback = (time: number) => {
        if (audioLoadedRef.current) {
          // Temporarily disable time update callbacks
          timeUpdateCallbackEnabledRef.current = false;
          
          // Set the continuous play flag to ensure playback continues
          continuousPlayRef.current = true;
          
          // Remember if we were playing
          playAfterSeekRef.current = isPlaying || !audioRef.current?.paused;
          
          // Jump to the requested time
          jumpToTime(time);
          
          // Re-enable callbacks after a delay
          setTimeout(() => {
            timeUpdateCallbackEnabledRef.current = true;
          }, 300);
        }
      };
      
      const cleanupFunction = onJumpToTime(stableJumpToTimeCallback);
      
      return () => {
        // Only call the cleanup function if it exists and is callable
        if (typeof cleanupFunction === 'function') {
          cleanupFunction();
        }
      };
    }
    
    return undefined;
  }, [jumpToTime, onJumpToTime, isPlaying]);

  // Handle src changes with proper cleanup
  useEffect(() => {
    if (src && src !== srcRef.current) {
      // Reset all state and refs
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsBuffering(false);
      seekOperationInProgressRef.current = false;
      seekQueueRef.current = null;
      playAfterSeekRef.current = false;
      lastReportedTimeRef.current = -1;
      lastTimeUpdateRef.current = 0;
      updateLockRef.current = false;
      timeUpdateCallbackEnabledRef.current = true;
      audioLoadedRef.current = false;
      continuousPlayRef.current = true;
      
      // Reset and reload audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      }
      
      srcRef.current = src;
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
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
        playsInline
      />
      
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
          disabled={isLoading || currentTime === 0 || updateLockRef.current}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
          disabled={isLoading || !src || updateLockRef.current || !audioLoadedRef.current}
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
          disabled={isLoading || currentTime >= duration || updateLockRef.current}
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
          disabled={isLoading || !src || updateLockRef.current || !audioLoadedRef.current}
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* Simplified visual indicators */}
      <div className="text-xs text-center text-muted-foreground">
        {(isSeeking || isBuffering || isLoading) && (
          <span className="animate-pulse">
            {isSeeking ? "Seeking" : isBuffering ? "Buffering" : "Loading"}...{" "}
          </span>
        )}
        <span className={isPlaying ? "text-green-600 font-medium" : ""}>
          {isPlaying ? "Playing" : "Paused"}
        </span>
      </div>
    </div>
  );
}
